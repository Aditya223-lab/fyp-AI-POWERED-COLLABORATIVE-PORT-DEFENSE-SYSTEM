package com.example.portdefense.service;

import com.example.portdefense.domain.GeoLocation;
import com.example.portdefense.domain.Organization;
import com.example.portdefense.domain.ScanType;
import com.example.portdefense.domain.Severity;
import com.example.portdefense.domain.Threat;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class ThreatGenerator {

    private static final Severity[] SEVERITIES = Severity.values();
    private static final ScanType[] SCAN_TYPES = ScanType.values();
    private static final int[] PORTS = {22, 80, 443, 3306, 5432, 6379, 8080, 8443, 27017};
    private static final String[] SERVICES = {"SSH", "HTTP", "HTTPS", "MySQL", "Postgres", "Redis", "Mongo"};
    // Attack families — kept in sync with the Python model's classes so the
    // dashboard reads consistently whether a threat comes from the AI or here.
    private static final String[] ATTACK_TYPES = {
            "PortScan", "DoS", "DDoS", "BruteForce", "WebAttack", "Bot",
            "Infiltration", "Heartbleed" , 
    };

    /**
     * Curated source profiles — each prefix maps to a real-world country/city/
     * coords so the map looks honest. We use RFC 5737 documentation ranges
     * (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) and well-known cloud /
     * hosting ranges that are commonly seen in port-scan telemetry. Safe for
     * academic use — these are documentation IPs or large public allocations,
     * NOT pointing at specific victims.
     */
    private record SourceProfile(
            String prefix,    // first three octets, e.g. "203.0.113"
            String country,   // ISO 3166-1 alpha-2
            String city,
            double lat,
            double lng,
            String asn        // human-readable ASN/owner for tooltips
    ) {}

    private static final SourceProfile[] PROFILES = new SourceProfile[]{
            // RFC 5737 documentation ranges — safe demo IPs
            new SourceProfile("203.0.113", "NL", "Amsterdam", 52.37, 4.90, "AS15169 TEST-NET-3"),
            new SourceProfile("198.51.100", "US", "Ashburn", 39.04, -77.49, "AS14618 TEST-NET-2"),
            new SourceProfile("192.0.2", "US", "San Jose", 37.34, -121.89, "AS396982 TEST-NET-1"),
            // Realistic-looking public ranges commonly seen in scanner traffic
            new SourceProfile("45.33.21", "US", "Newark", 40.74, -74.17, "AS63949 Linode"),
            new SourceProfile("78.140.10", "DE", "Frankfurt", 50.11, 8.68, "AS9009 M247"),
            new SourceProfile("91.108.4", "RU", "St Petersburg", 59.93, 30.34, "AS62041 Telegram"),
            new SourceProfile("194.61.55", "GB", "London", 51.51, -0.13, "AS35017 Swiftway"),
            new SourceProfile("5.188.10", "NL", "Amsterdam", 52.37, 4.90, "AS49505 Selectel"),
            new SourceProfile("103.252.116", "IN", "Mumbai", 19.08, 72.88, "AS135161 GreenCloud"),
            new SourceProfile("182.43.124", "CN", "Beijing", 39.91, 116.40, "AS37963 Alibaba"),
            new SourceProfile("159.65.180", "SG", "Singapore", 1.29, 103.85, "AS14061 DigitalOcean"),
            new SourceProfile("167.99.74", "DE", "Frankfurt", 50.11, 8.68, "AS14061 DigitalOcean"),
            new SourceProfile("31.7.62", "FR", "Paris", 48.86, 2.35, "AS204428 SS-Net"),
            new SourceProfile("128.199.156", "IN", "Bangalore", 12.97, 77.59, "AS14061 DigitalOcean"),
            new SourceProfile("139.59.21", "IN", "Bangalore", 12.97, 77.59, "AS14061 DigitalOcean"),
            new SourceProfile("64.227.123", "US", "New York", 40.71, -74.01, "AS14061 DigitalOcean"),
            new SourceProfile("117.50.187", "CN", "Shanghai", 31.23, 121.47, "AS37963 Alibaba"),
            new SourceProfile("46.101.241", "DE", "Frankfurt", 50.11, 8.68, "AS14061 DigitalOcean"),
            new SourceProfile("220.79.34", "JP", "Tokyo", 35.68, 139.69, "AS17676 SoftBank"),
            new SourceProfile("190.103.179", "BR", "São Paulo", -23.55, -46.63, "AS27651 Embratel"),
            new SourceProfile("41.86.42", "KE", "Nairobi", -1.29, 36.82, "AS33771 Safaricom"),
            new SourceProfile("105.235.130", "NP", "Kathmandu", 27.71, 85.32, "AS17501 World Link")
    };

    public Threat generate(List<Organization> orgs, int offsetMinutes) {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        Organization org = orgs.get(rnd.nextInt(orgs.size()));
        SourceProfile p = PROFILES[rnd.nextInt(PROFILES.length)];

        // Realistic public IP: keep the curated /24 prefix, randomize the host.
        String ip = p.prefix() + "." + (1 + rnd.nextInt(254));

        // Light jitter on coords so multiple events from the same city don't
        // perfectly overlap on the map (looks more like real telemetry).
        double latJitter = (rnd.nextDouble() - 0.5) * 0.3;
        double lngJitter = (rnd.nextDouble() - 0.5) * 0.3;

        Threat t = new Threat();
        t.setId("thr-" + UUID.randomUUID().toString().substring(0, 12));
        t.setSourceIP(ip);
        t.setTargetPort(PORTS[rnd.nextInt(PORTS.length)]);
        // Point the event at one of the victim org's own IPs so the feed shows
        // who was hit, not just which org.
        List<String> orgIps = org.getIpAddresses();
        if (orgIps != null && !orgIps.isEmpty()) {
            t.setTargetIp(orgIps.get(rnd.nextInt(orgIps.size())));
        }
        t.setTargetService(SERVICES[rnd.nextInt(SERVICES.length)]);
        t.setTimestamp(Instant.now().minusSeconds(offsetMinutes * 60L));
        t.setSeverity(SEVERITIES[rnd.nextInt(SEVERITIES.length)]);
        t.setScanType(SCAN_TYPES[rnd.nextInt(SCAN_TYPES.length)]);
        t.setAttackType(ATTACK_TYPES[rnd.nextInt(ATTACK_TYPES.length)]);
        t.setAnomalyScore(Math.round(rnd.nextDouble() * 100.0) / 100.0);
        t.setOrganizationId(org.getId());
        t.setOrganizationName(org.getName());
        t.setLocation(new GeoLocation(
                p.lat() + latJitter,
                p.lng() + lngJitter,
                p.country(),
                p.city()
        ));
        t.setZeroDay(rnd.nextDouble() < 0.15);
        t.setConfidence(0.6 + rnd.nextDouble() * 0.4);
        t.setResponseTime(50 + rnd.nextInt(900));
        return t;
    }
}
