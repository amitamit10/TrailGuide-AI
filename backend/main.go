package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/trailguide/backend/config"
	"github.com/trailguide/backend/db"
	"github.com/trailguide/backend/handlers"
	"github.com/trailguide/backend/middleware"
)

func main() {
	// Load .env if present (ignored in production where env is set externally)
	_ = godotenv.Load()

	cfg := config.Load()
	pool := db.Connect(cfg.DatabaseURL)
	defer pool.Close()

	r := gin.Default()

	// CORS — origin is configurable (CORS_ALLOW_ORIGIN); pin it to the frontend
	// origin in production rather than the wildcard default.
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", cfg.CORSAllowOrigin)
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Health (unauthenticated)
	r.GET("/health", handlers.Health)

	// All v1 routes require a valid Supabase JWT
	auth := middleware.Auth(cfg.SupabaseJWTSecret)
	v1 := r.Group("/api/v1", auth)

	// Trip CRUD (Go handles these directly against Postgres)
	trips := handlers.NewTripsHandler(pool)
	v1.GET("/trips", trips.List)
	v1.POST("/trips", trips.Create)
	v1.GET("/trips/:id", trips.Get)
	v1.PUT("/trips/:id", trips.Update)
	v1.DELETE("/trips/:id", trips.Delete)

	// AI + utility routes (proxied to Python AI service)
	proxy := handlers.NewAIProxyHandler(cfg.AIServiceURL, cfg.InternalAPISecret)
	v1.Any("/ai/*path", proxy.ProxyAI)
	v1.Any("/documents/*path", proxy.ProxyDocuments)
	v1.Any("/places/*path", proxy.ProxyPlaces)
	v1.Any("/weather", proxy.ProxyWeather)

	addr := ":" + cfg.Port
	log.Printf("Listening and serving HTTP on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
