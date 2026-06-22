package handlers

import (
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type AIProxyHandler struct {
	aiServiceURL      string
	internalAPISecret string
	client            *http.Client
}

func NewAIProxyHandler(aiServiceURL, internalAPISecret string) *AIProxyHandler {
	return &AIProxyHandler{
		aiServiceURL:      strings.TrimRight(aiServiceURL, "/"),
		internalAPISecret: internalAPISecret,
		client:            &http.Client{Timeout: 55 * time.Second},
	}
}

// ProxyAI forwards any /api/v1/ai/* request to the Python AI service.
// The upstream path is derived by stripping the /api/v1 prefix.
func (h *AIProxyHandler) ProxyAI(c *gin.Context) {
	upstream := h.aiServiceURL + strings.TrimPrefix(c.Request.URL.RequestURI(), "/api/v1")
	h.proxy(c, upstream)
}

// ProxyDocuments forwards /api/v1/documents/* to the Python service.
func (h *AIProxyHandler) ProxyDocuments(c *gin.Context) {
	upstream := h.aiServiceURL + strings.TrimPrefix(c.Request.URL.RequestURI(), "/api/v1")
	h.proxy(c, upstream)
}

// ProxyPlaces forwards /api/v1/places/* to the Python service.
func (h *AIProxyHandler) ProxyPlaces(c *gin.Context) {
	upstream := h.aiServiceURL + strings.TrimPrefix(c.Request.URL.RequestURI(), "/api/v1")
	h.proxy(c, upstream)
}

// ProxyWeather forwards /api/v1/weather to the Python service.
func (h *AIProxyHandler) ProxyWeather(c *gin.Context) {
	upstream := h.aiServiceURL + strings.TrimPrefix(c.Request.URL.RequestURI(), "/api/v1")
	h.proxy(c, upstream)
}

func (h *AIProxyHandler) proxy(c *gin.Context, upstreamURL string) {
	req, err := http.NewRequestWithContext(c.Request.Context(), c.Request.Method, upstreamURL, c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to build upstream request"})
		return
	}

	// Forward original headers except Host
	for key, vals := range c.Request.Header {
		if strings.EqualFold(key, "host") {
			continue
		}
		for _, v := range vals {
			req.Header.Add(key, v)
		}
	}
	req.Header.Set("X-Internal-Token", h.internalAPISecret)

	resp, err := h.client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, vals := range resp.Header {
		for _, v := range vals {
			c.Header(key, v)
		}
	}
	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}
