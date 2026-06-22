package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trailguide/backend/middleware"
)

type TripsHandler struct {
	db *pgxpool.Pool
}

func NewTripsHandler(db *pgxpool.Pool) *TripsHandler {
	return &TripsHandler{db: db}
}

type Trip struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	Title       string     `json:"title"`
	Destination string     `json:"destination"`
	StartDate   string     `json:"start_date"`
	EndDate     string     `json:"end_date"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (h *TripsHandler) List(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	rows, err := h.db.Query(context.Background(),
		`SELECT id, user_id, title, destination, start_date, end_date, status, created_at, updated_at
		 FROM trips WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch trips"})
		return
	}
	defer rows.Close()

	trips := []Trip{}
	for rows.Next() {
		var t Trip
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &t.Destination,
			&t.StartDate, &t.EndDate, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		trips = append(trips, t)
	}
	c.JSON(http.StatusOK, trips)
}

func (h *TripsHandler) Get(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	tripID := c.Param("id")

	var t Trip
	err := h.db.QueryRow(context.Background(),
		`SELECT id, user_id, title, destination, start_date, end_date, status, created_at, updated_at
		 FROM trips WHERE id = $1 AND user_id = $2`, tripID, userID).
		Scan(&t.ID, &t.UserID, &t.Title, &t.Destination,
			&t.StartDate, &t.EndDate, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *TripsHandler) Create(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var body struct {
		Title       string `json:"title" binding:"required"`
		Destination string `json:"destination" binding:"required"`
		StartDate   string `json:"start_date" binding:"required"`
		EndDate     string `json:"end_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var t Trip
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO trips (user_id, title, destination, start_date, end_date, status)
		 VALUES ($1, $2, $3, $4, $5, 'planning')
		 RETURNING id, user_id, title, destination, start_date, end_date, status, created_at, updated_at`,
		userID, body.Title, body.Destination, body.StartDate, body.EndDate).
		Scan(&t.ID, &t.UserID, &t.Title, &t.Destination,
			&t.StartDate, &t.EndDate, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create trip"})
		return
	}
	c.JSON(http.StatusCreated, t)
}

func (h *TripsHandler) Update(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	tripID := c.Param("id")

	var body struct {
		Title       *string `json:"title"`
		Destination *string `json:"destination"`
		StartDate   *string `json:"start_date"`
		EndDate     *string `json:"end_date"`
		Status      *string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.Status != nil {
		switch *body.Status {
		case "planning", "active", "completed":
			// valid
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be planning, active, or completed"})
			return
		}
	}

	var t Trip
	err := h.db.QueryRow(context.Background(),
		`UPDATE trips
		 SET title       = COALESCE($3, title),
		     destination = COALESCE($4, destination),
		     start_date  = COALESCE($5, start_date),
		     end_date    = COALESCE($6, end_date),
		     status      = COALESCE($7, status),
		     updated_at  = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, title, destination, start_date, end_date, status, created_at, updated_at`,
		tripID, userID, body.Title, body.Destination, body.StartDate, body.EndDate, body.Status).
		Scan(&t.ID, &t.UserID, &t.Title, &t.Destination,
			&t.StartDate, &t.EndDate, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *TripsHandler) Delete(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	tripID := c.Param("id")

	tag, err := h.db.Exec(context.Background(),
		`DELETE FROM trips WHERE id = $1 AND user_id = $2`, tripID, userID)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
		return
	}
	c.Status(http.StatusNoContent)
}
