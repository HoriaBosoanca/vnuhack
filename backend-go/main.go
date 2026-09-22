// main.go
//
// Simple single-file Go server backed by Postgres.
//
// Endpoints:
//   POST /        -> reads the raw request body and stores it as a new row
//   GET  /        -> returns all rows as JSON
//   GET  /{id}    -> returns a single row by id as JSON
//
// Config:
//   DB_URL   Postgres connection string, e.g.
//            postgres://user:pass@host:5432/dbname?sslmode=require
//   PORT     optional, defaults to 8080
//
// Build/run:
//   go mod init demo
//   go get github.com/lib/pq
//   DB_URL="postgres://..." go run main.go

package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"
)

type Item struct {
	ID        int       `json:"id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

var db *sql.DB

func main() {
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		log.Fatal("DB_URL environment variable is required")
	}

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}

	if err := ensureSchema(); err != nil {
		log.Fatalf("failed to set up schema: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", rootHandler)

	handler := withCORS(mux)
	
	port := "8080"
	log.Printf("listening on :%s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}

// withCORS allows browser-based clients (like a React dev server on
// localhost) to call this API from a different origin.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func ensureSchema() error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS items (
			id SERIAL PRIMARY KEY,
			content TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	return err
}

// rootHandler dispatches based on method and path:
//   POST /        -> create
//   GET  /        -> list all
//   GET  /{id}    -> get one
func rootHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		createItem(w, r)
	case http.MethodGet:
		if r.URL.Path == "/" {
			listItems(w, r)
			return
		}
		getItemByID(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func createItem(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var item Item
	err = db.QueryRow(
		`INSERT INTO items (content) VALUES ($1) RETURNING id, content, created_at`,
		string(body),
	).Scan(&item.ID, &item.Content, &item.CreatedAt)
	if err != nil {
		http.Error(w, "failed to insert: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, item)
}

func listItems(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`SELECT id, content, created_at FROM items ORDER BY id`)
	if err != nil {
		http.Error(w, "failed to query: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []Item{}
	for rows.Next() {
		var item Item
		if err := rows.Scan(&item.ID, &item.Content, &item.CreatedAt); err != nil {
			http.Error(w, "failed to scan: "+err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}

	writeJSON(w, http.StatusOK, items)
}

func getItemByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[1:] // strip leading "/"
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var item Item
	err = db.QueryRow(
		`SELECT id, content, created_at FROM items WHERE id = $1`, id,
	).Scan(&item.ID, &item.Content, &item.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "failed to query: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, item)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}