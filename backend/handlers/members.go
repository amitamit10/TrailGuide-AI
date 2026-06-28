package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trailguide/backend/middleware"
)

type MembersHandler struct {
	DB *pgxpool.Pool
}

func (h *MembersHandler) List(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	tripID := c.Param("tripId")

	// Verify caller owns the trip
	var ownerID string
	err := h.DB.QueryRow(context.Background(),
		"SELECT user_id FROM trips WHERE id = $1", tripID).Scan(&ownerID)
	if err != nil || ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	rows, err := h.DB.Query(context.Background(), `
		SELECT tm.id, tm.trip_id, tm.user_id, tm.role, tm.invited_email, tm.accepted_at,
		       p.full_name, p.avatar_url
		FROM trip_members tm
		LEFT JOIN profiles p ON p.id = tm.user_id
		WHERE tm.trip_id = $1
		ORDER BY tm.created_at`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type MemberRow struct {
		ID           string  `json:"id"`
		TripID       string  `json:"trip_id"`
		UserID       *string `json:"user_id"`
		Role         string  `json:"role"`
		InvitedEmail *string `json:"invited_email"`
		AcceptedAt   *string `json:"accepted_at"`
		FullName     *string `json:"full_name"`
		AvatarURL    *string `json:"avatar_url"`
	}

	var members []MemberRow
	for rows.Next() {
		var m MemberRow
		if err := rows.Scan(&m.ID, &m.TripID, &m.UserID, &m.Role,
			&m.InvitedEmail, &m.AcceptedAt, &m.FullName, &m.AvatarURL); err != nil {
			continue
		}
		members = append(members, m)
	}
	if members == nil {
		members = []MemberRow{}
	}
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *MembersHandler) Invite(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	tripID := c.Param("tripId")

	var body struct {
		Email string `json:"email" binding:"required,email"`
		Role  string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email required"})
		return
	}
	if body.Role == "" {
		body.Role = "editor"
	}
	if body.Role != "editor" && body.Role != "viewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be editor or viewer"})
		return
	}

	// Verify caller owns trip
	var ownerID string
	err := h.DB.QueryRow(context.Background(),
		"SELECT user_id FROM trips WHERE id = $1", tripID).Scan(&ownerID)
	if err != nil || ownerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	// Find user by email in profiles
	var inviteeID *string
	h.DB.QueryRow(context.Background(),
		"SELECT id FROM profiles WHERE email = $1", body.Email).Scan(&inviteeID)

	_, err = h.DB.Exec(context.Background(), `
		INSERT INTO trip_members (trip_id, user_id, role, invited_by, invited_email)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (trip_id, user_id) DO NOTHING`,
		tripID, inviteeID, body.Role, userID, body.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"ok": true})
}

func (h *MembersHandler) Remove(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	tripID := c.Param("tripId")
	memberUserID := c.Param("userId")

	// Verify caller owns trip or is removing themselves
	var ownerID string
	h.DB.QueryRow(context.Background(),
		"SELECT user_id FROM trips WHERE id = $1", tripID).Scan(&ownerID)
	if ownerID != userID && memberUserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	h.DB.Exec(context.Background(),
		"DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2",
		tripID, memberUserID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
