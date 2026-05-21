package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class GeoLocation {

    @Column(name = "loc_lat")
    private Double lat;

    @Column(name = "loc_lng")
    private Double lng;

    @Column(name = "loc_country", length = 64)
    private String country;

    @Column(name = "loc_city", length = 128)
    private String city;

    public GeoLocation() {
    }

    public GeoLocation(Double lat, Double lng, String country, String city) {
        this.lat = lat;
        this.lng = lng;
        this.country = country;
        this.city = city;
    }

    public Double getLat() { return lat; }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { return lng; }
    public void setLng(Double lng) { this.lng = lng; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
}
