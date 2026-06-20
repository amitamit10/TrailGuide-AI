package config

import (
	"log"
	"os"
)

type Config struct {
	Port             string
	DatabaseURL      string
	SupabaseJWTSecret string
	AIServiceURL     string
	InternalAPISecret string
	TelegramBotToken string
}

func Load() *Config {
	c := &Config{
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       mustEnv("DATABASE_URL"),
		SupabaseJWTSecret: mustEnv("SUPABASE_JWT_SECRET"),
		AIServiceURL:      getEnv("AI_SERVICE_URL", "http://localhost:8081"),
		InternalAPISecret: mustEnv("INTERNAL_API_SECRET"),
		TelegramBotToken:  os.Getenv("TELEGRAM_BOT_TOKEN"),
	}
	return c
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}
