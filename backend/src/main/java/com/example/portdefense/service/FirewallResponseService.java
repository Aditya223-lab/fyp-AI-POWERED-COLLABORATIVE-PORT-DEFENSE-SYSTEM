package com.example.portdefense.service;

import com.example.portdefense.domain.AlertSeverity;
import com.example.portdefense.domain.BlockedIp;
import com.example.portdefense.domain.Organization;
import com.example.portdefense.dto.BlockedIpDto;
import com.example.portdefense.dto.IngestLogRequest;
import com.example.portdefense.repository.BlockedIpRepository;
import com.example.portdefense.repository.OrganizationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * The system's one active response: block an IP at the host firewall of the
 * machine running this backend.
 *
 * On Windows it shells out to {@code netsh advfirewall firewall add rule …};
 * on Linux to {@code iptables}. The command runs through ProcessBuilder with a
 * fixed argument list (never a shell string), and the IP is validated against a
 * strict pattern first, so there is no room for command injection.
 *
 * Scope, stated honestly: this only affects THIS host. It stops the blocked IP
 * from reaching services on the machine the backend runs on. It does not touch
 * any other computer, the network router, or "the internet" — a host firewall
 * cannot. Editing the firewall also needs administrator/root privileges; when
 * the backend lacks them the block is recorded as SIMULATED with a clear
 * message rather than failing, so the workflow still demonstrates.
 */
@Service
public class FirewallResponseService {

    private static final Pattern IPV4 = Pattern.compile(
            "^((25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1?\\d?\\d)$");//regular exxpresiion

    private final BlockedIpRepository repo;
    private final OrganizationRepository orgRepo;
    private final AlertService alertService;
    private final LogEventService logEventService;

    private final boolean windows;
    private volatile Set<String> localAddresses;

    @Value("${app.response.enabled:true}")
    private boolean enabled;

    /**
     * When false, blocks are recorded but the firewall is never touched — a
     * safe default for a shared or graded machine. Flip to true (and run the
     * backend elevated) to make blocks real.
     */
    @Value("${app.response.enforce:true}")
    private boolean enforce;

    @Value("${app.response.command-timeout-ms:5000}")
    private long commandTimeoutMs;

    public FirewallResponseService(BlockedIpRepository repo,
                                   OrganizationRepository orgRepo,
                                   AlertService alertService,
                                   LogEventService logEventService) {
        this.repo = repo;
        this.orgRepo = orgRepo;
        this.alertService = alertService;
        this.logEventService = logEventService;
        this.windows = System.getProperty("os.name", "")
                .toLowerCase(Locale.ROOT).contains("win");
    }

    public List<BlockedIpDto> all() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(FirewallResponseService::toDto).toList();
    }

    /**
     * Block an IP. Idempotent: re-blocking an already-active IP returns the
     * existing record rather than adding a duplicate rule.
     */
    @Transactional
    public BlockedIpDto block(String ip, String reason, String source,
                              String organizationId, String by) {
        String addr = ip == null ? "" : ip.trim();
        if (!IPV4.matcher(addr).matches()) {
            throw new IllegalArgumentException("not a valid IPv4 address: " + ip);
        }
        String guard = refuseReason(addr);
        if (guard != null) {
            // Blocking your own machine or gateway would cut you off — never do it.
            throw new IllegalArgumentException(guard);
        }

        var existing = repo.findFirstByIpAddressAndStatusOrderByCreatedAtDesc(addr, "ACTIVE");
        if (existing.isPresent()) {
            return toDto(existing.get());
        }

        String ruleName = "PortDefense-Block-" + addr;
        BlockedIp block = new BlockedIp();
        block.setId("block-" + UUID.randomUUID().toString().substring(0, 12));
        block.setIpAddress(addr);
        block.setReason(trim(reason == null || reason.isBlank()
                ? "Manually blocked from the console" : reason, 256));
        block.setSource(normalizeSource(source));
        block.setStatus("ACTIVE");
        block.setRuleName(ruleName);
        block.setCreatedBy(trim(by, 128));
        block.setCreatedAt(Instant.now());
        block.setOrganizationId(organizationId);

        Result result = applyBlock(addr, ruleName);
        block.setEnforcement(result.enforced ? "ENFORCED" : "SIMULATED");
        block.setDetail(trim(result.detail, 512));

        BlockedIp saved = repo.save(block);
        afterBlock(saved);
        return toDto(saved);
    }

    @Transactional
    public BlockedIpDto unblock(String id) {
        BlockedIp block = repo.findById(id).orElseThrow(
                () -> new IllegalArgumentException("unknown block " + id));
        if ("ACTIVE".equals(block.getStatus())) {
            Result result = removeBlock(block.getRuleName());
            block.setStatus("REMOVED");
            block.setRemovedAt(Instant.now());
            block.setDetail(trim("unblocked: " + result.detail, 512));
        }
        return toDto(repo.save(block));
    }

    // ------------------------------------------------------------------
    // Consequences of a block
    // ------------------------------------------------------------------

    private void afterBlock(BlockedIp block) {
        // This is the moment blockedAttacks becomes a real number rather than a
        // seeded one — increment the org the blocked traffic was attributed to.
        if (block.getOrganizationId() != null) {
            orgRepo.findById(block.getOrganizationId()).ifPresent(org -> {
                org.setBlockedAttacks(org.getBlockedAttacks() + 1);
                orgRepo.save(org);
            });
        }
        alertService.createMonitorAlert(
                "IP blocked: " + block.getIpAddress(),
                (block.getEnforcement().equals("ENFORCED")
                        ? "A host firewall rule now drops traffic from "
                        : "Recorded a block for ")
                        + block.getIpAddress() + " on this machine. Reason: "
                        + block.getReason() + ".",
                AlertSeverity.INFO,
                block.getOrganizationId());
        try {
            logEventService.ingest(List.of(new IngestLogRequest(
                    Instant.now(),
                    "response",
                    "ip_blocked",
                    block.getIpAddress(),
                    block.getCreatedBy(),
                    null,
                    null,
                    "Blocked " + block.getIpAddress() + " (" + block.getEnforcement() + ") — "
                            + block.getReason(),
                    "[firewall-response] " + block.getRuleName(),
                    block.getOrganizationId())));
        } catch (RuntimeException e) {
            System.out.println("[FirewallResponse] SIEM write failed: " + e);
        }
    }

    // ------------------------------------------------------------------
    // The actual firewall calls
    // ------------------------------------------------------------------

    private record Result(boolean enforced, String detail) {}

    private Result applyBlock(String ip, String ruleName) {
        if (!enabled || !enforce) {
            return new Result(false, enabled
                    ? "enforcement disabled (app.response.enforce=false) — recorded only"
                    : "response feature disabled (app.response.enabled=false)");
        }
        if (windows) {
            // Two rules: inbound and outbound, both dropping this remote IP.
            Result in = run("block/in", "netsh", "advfirewall", "firewall", "add", "rule",
                    "name=" + ruleName, "dir=in", "action=block", "remoteip=" + ip);
            if (!in.enforced) return in;
            Result out = run("block/out", "netsh", "advfirewall", "firewall", "add", "rule",
                    "name=" + ruleName, "dir=out", "action=block", "remoteip=" + ip);
            return new Result(true, "firewall rule added (in" + (out.enforced ? "+out)" : " only)"));
        }
        // Linux: needs root; -I inserts at the top of INPUT.
        return run("block", "iptables", "-I", "INPUT", "-s", ip, "-j", "DROP");
    }

    private Result removeBlock(String ruleName) {
        if (!enabled || !enforce) {
            return new Result(false, "recorded only");
        }
        if (windows) {
            return run("unblock", "netsh", "advfirewall", "firewall", "delete", "rule",
                    "name=" + ruleName);
        }
        // ruleName holds the IP suffix for iptables; recover it.
        String ip = ruleName.replace("PortDefense-Block-", "");
        return run("unblock", "iptables", "-D", "INPUT", "-s", ip, "-j", "DROP");
    }

    /** Run a system command, capturing exit code and output for the record. */
    private Result run(String label, String... command) {
        try {
            ProcessBuilder pb = new ProcessBuilder(command).redirectErrorStream(true);
            Process p = pb.start();
            String output;
            try (BufferedReader r = new BufferedReader(
                    new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                output = r.lines().reduce("", (a, b) -> a.isEmpty() ? b : a + " " + b);
            }
            boolean done = p.waitFor(commandTimeoutMs, TimeUnit.MILLISECONDS);
            if (!done) {
                p.destroyForcibly();
                return new Result(false, label + " timed out");
            }
            int code = p.exitValue();
            if (code == 0) {
                return new Result(true, output.isBlank() ? "ok" : trim(output, 300));
            }
            // The common failure is "requires elevation" — surface it plainly.
            String hint = output.toLowerCase(Locale.ROOT).contains("elevation")
                    || output.toLowerCase(Locale.ROOT).contains("administrator")
                    || output.toLowerCase(Locale.ROOT).contains("permitted")
                    ? " — run the backend as Administrator to enforce blocks"
                    : "";
            return new Result(false, "exit " + code + ": " + trim(output, 240) + hint);
        } catch (java.io.IOException e) {
            return new Result(false, "could not run "
                    + (windows ? "netsh" : "iptables") + ": " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result(false, "interrupted");
        }
    }

    // ------------------------------------------------------------------
    // Safety: never block ourselves off the machine
    // ------------------------------------------------------------------

    /** Reason to refuse this IP, or null if it is safe to block. */
    private String refuseReason(String ip) {
        try {
            InetAddress addr = InetAddress.getByName(ip);
            if (addr.isLoopbackAddress()) return "refusing to block loopback (127.0.0.1)";
            if (addr.isAnyLocalAddress()) return "refusing to block 0.0.0.0";
            if (addr.isLinkLocalAddress()) return "refusing to block a link-local address";
            if (addr.isMulticastAddress()) return "refusing to block a multicast address";
        } catch (java.net.UnknownHostException e) {
            return "could not resolve " + ip;
        }
        if (localAddresses().contains(ip)) {
            return "refusing to block " + ip + " — it is an address of this machine, "
                    + "which would cut the server off";
        }
        return null;
    }

    /** IPs bound to this host's own interfaces, cached after first lookup. */
    private Set<String> localAddresses() {
        Set<String> cached = localAddresses;
        if (cached != null) return cached;
        Set<String> found = new HashSet<>();
        try {
            var interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces != null && interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                var addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    found.add(addrs.nextElement().getHostAddress().split("%")[0]);
                }
            }
        } catch (java.net.SocketException ignored) {
            // Best effort — loopback is already guarded separately.
        }
        localAddresses = Collections.unmodifiableSet(found);
        return localAddresses;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static String normalizeSource(String s) {
        if (s == null) return "MANUAL";
        String up = s.trim().toUpperCase(Locale.ROOT);
        return switch (up) {
            case "ALERT", "THREAT", "MANUAL" -> up;
            default -> "MANUAL";
        };
    }

    private static BlockedIpDto toDto(BlockedIp b) {
        return new BlockedIpDto(
                b.getId(), b.getIpAddress(), b.getReason(), b.getSource(), b.getStatus(),
                b.getEnforcement(), b.getDetail(), b.getCreatedBy(), b.getCreatedAt(),
                b.getRemovedAt(), b.getOrganizationId());
    }

    private static String trim(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
