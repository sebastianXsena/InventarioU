# LabReserve API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Auth Endpoints

### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "role": "student"
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student"
  }
}
```

### POST /auth/login
Authenticate and receive a JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

### GET /auth/me
Get current user profile. **Requires: Auth**

### GET /auth/users
List all users. **Requires: Auth + Admin**

---

## Laboratories Endpoints

### GET /labs
List all laboratories.

### GET /labs/active
List only active laboratories.

### GET /labs/:id
Get laboratory by ID.

### POST /labs
Create a new laboratory. **Requires: Auth + Admin**

**Request Body:**
```json
{
  "name": "Lab A - Programming",
  "location": "Building 1, Floor 2",
  "capacity": 30,
  "status": "active"
}
```

### PATCH /labs/:id
Update laboratory. **Requires: Auth + Admin**

### DELETE /labs/:id
Delete laboratory. **Requires: Auth + Admin**

---

## Items (Inventory) Endpoints

### GET /items
List all items across all labs.

### GET /items/stats
Get item usage statistics. **Requires: Auth + Admin**

### GET /items/lab/:labId
List items for a specific lab.

### GET /items/:id
Get item by ID.

### POST /items
Create a new item. **Requires: Auth + Admin**

**Request Body:**
```json
{
  "name": "Desktop Computer",
  "description": "PC with 24 inch monitor",
  "total_stock": 30,
  "lab_id": "uuid"
}
```

### PATCH /items/:id
Update item. **Requires: Auth + Admin**

### DELETE /items/:id
Delete item. **Requires: Auth + Admin**

---

## Reservations Endpoints

### GET /reservations
List all reservations (supports filters). **Requires: Auth**

**Query Parameters:**
- `status`: pending | approved | rejected | cancelled
- `lab_id`: Filter by lab
- `start_date`: ISO date
- `end_date`: ISO date

### GET /reservations/my
Get current user's reservations. **Requires: Auth**

### GET /reservations/:id
Get reservation details with items. **Requires: Auth**

### GET /reservations/lab/:labId
Get reservations for a lab within date range. **Requires: Auth**

**Query Parameters:**
- `start_date`: Required ISO datetime
- `end_date`: Required ISO datetime

### POST /reservations
Create a new reservation. **Requires: Auth**

**Request Body:**
```json
{
  "lab_id": "uuid",
  "start_time": "2026-05-10T09:00:00",
  "end_time": "2026-05-10T11:00:00",
  "notes": "Python practice session",
  "items": [
    { "item_id": "uuid", "quantity_used": 5 }
  ]
}
```

**Response (201):** Reservation created with status `pending`. Stock is NOT deducted until approved.

### PATCH /reservations/:id/approve
Approve or reject a reservation. **Requires: Auth + Admin**

**Request Body:**
```json
{
  "status": "approved"
}
```

**Important:** When approved, stock is automatically deducted within a SQL transaction.

### PATCH /reservations/:id/cancel
Cancel your own reservation. **Requires: Auth**

**Note:** If the reservation was approved, stock is automatically restored.

### GET /reservations/report/:year/:month
Get monthly report data. **Requires: Auth + Admin**

---

## Business Rules

### Reservation Creation (Student)
1. Cannot reserve in the past
2. No overlapping time slots per lab
3. Stock must be available for requested items
4. Status starts as `pending` - stock NOT deducted

### Approval Process (Admin)
1. Only `pending` reservations can be approved/rejected
2. On **approve**: stock is deducted atomically via SQL transaction
3. On **reject**: no stock changes
4. If transaction fails, both status change and stock deduction are rolled back

### Cancellation
1. Students can only cancel their own reservations
2. If `approved`, stock is restored
3. If `pending`, just status changes to `cancelled`

### Database Constraints
- Exclusion constraint prevents overlapping approved reservations per lab
- Stock consistency: `available_stock <= total_stock`
- Foreign key constraints ensure referential integrity
- Time validity: `end_time > start_time`
- Future reservation: `start_time > CURRENT_TIMESTAMP`

---

## Error Responses

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad Request (validation error, invalid data) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate, overlapping reservation) |
| 500 | Internal Server Error |
