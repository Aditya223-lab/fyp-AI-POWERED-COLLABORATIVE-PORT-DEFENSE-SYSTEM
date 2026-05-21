package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "attack_predictions")
public class AttackPrediction {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(nullable = false)
    private int predictedCount;

    @Column(nullable = false)
    private double confidence;

    @ElementCollection(fetch = FetchType.EAGER)
    @Column(length = 64)
    private List<String> likelySources = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    private List<Integer> targetPorts = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @Column(length = 512)
    private List<String> recommendedActions = new ArrayList<>();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public int getPredictedCount() { return predictedCount; }
    public void setPredictedCount(int predictedCount) { this.predictedCount = predictedCount; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public List<String> getLikelySources() { return likelySources; }
    public void setLikelySources(List<String> likelySources) { this.likelySources = likelySources; }

    public List<Integer> getTargetPorts() { return targetPorts; }
    public void setTargetPorts(List<Integer> targetPorts) { this.targetPorts = targetPorts; }

    public List<String> getRecommendedActions() { return recommendedActions; }
    public void setRecommendedActions(List<String> recommendedActions) { this.recommendedActions = recommendedActions; }
}
