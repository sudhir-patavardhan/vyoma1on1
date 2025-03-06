# Vyoma 1:1 API Documentation

This document describes the API endpoints for the Vyoma 1:1 platform. The API is available at `api.sessions.red`.

## Authentication

All API requests (except for health checks) require authentication with a valid JWT token. 
The token must be included in the `Authorization` header as a Bearer token.

```
Authorization: Bearer <your_token>
```

## Base URL

All endpoints are relative to: `https://api.sessions.red`

## Endpoints

### Profile Management

#### GET /profiles
Retrieves a user's profile by their user ID.

**Query Parameters:**
- `user_id` (required): The unique identifier of the user

**Response:**
```json
{
  "profile": {
    "user_id": "string",
    "role": "student|teacher",
    "name": "string",
    "email": "string",
    "bio": "string",
    "created_at": "ISO-8601 timestamp",
    "updated_at": "ISO-8601 timestamp"
  }
}
```

#### POST /profiles
Creates or updates a user profile with role and personal information.

**Request Body:**
```json
{
  "user_id": "string",
  "role": "student|teacher",
  "profile_data": {
    "name": "string",
    "email": "string",
    "bio": "string"
  }
}
```

**Response:**
```json
{
  "profile_id": "string",
  "message": "Profile created/updated successfully"
}
```

### Bookings Management

#### GET /bookings
Retrieves bookings for a specific student or teacher.

**Query Parameters:**
- `student_id` OR `teacher_id` (at least one required): Filter bookings by student or teacher

**Response:**
```json
[
  {
    "booking_id": "string",
    "student_id": "string",
    "teacher_id": "string",
    "start_time": "ISO-8601 timestamp",
    "end_time": "ISO-8601 timestamp",
    "status": "pending|confirmed|completed|cancelled",
    "created_at": "ISO-8601 timestamp"
  }
]
```

#### POST /bookings
Creates a new booking for a student with a teacher.

**Request Body:**
```json
{
  "student_id": "string",
  "teacher_id": "string",
  "start_time": "ISO-8601 timestamp",
  "end_time": "ISO-8601 timestamp"
}
```

**Response:**
```json
{
  "booking_id": "string",
  "message": "Booking created successfully"
}
```

#### GET /bookings/{booking_id}/session
Retrieves the session associated with a specific booking.

**Path Parameters:**
- `booking_id` (required): The unique identifier of the booking

**Response:**
```json
{
  "session_id": "string",
  "booking_id": "string",
  "status": "pending|active|completed",
  "meeting_data": {},
  "notes": [],
  "files": []
}
```

### Teacher Availability Management

#### GET /availability
Retrieves availability slots for teachers.

**Query Parameters:**
- `teacher_id` (optional): If provided, returns only that teacher's availability

**Response:**
```json
[
  {
    "id": "string",
    "teacher_id": "string",
    "start_time": "ISO-8601 timestamp",
    "end_time": "ISO-8601 timestamp",
    "is_booked": boolean
  }
]
```

#### POST /availability
Creates a new availability slot for a teacher.

**Request Body:**
```json
{
  "teacher_id": "string",
  "start_time": "ISO-8601 timestamp",
  "end_time": "ISO-8601 timestamp"
}
```

**Response:**
```json
{
  "id": "string",
  "message": "Availability slot created successfully"
}
```

#### DELETE /availability/{id}
Deletes a specific availability slot for a teacher.

**Path Parameters:**
- `id` (required): The unique identifier of the availability slot

**Response:**
```json
{
  "message": "Availability slot deleted successfully"
}
```

### Session Management

#### GET /sessions/{id}
Retrieves a specific virtual session's details.

**Path Parameters:**
- `id` (required): The unique identifier of the session

**Response:**
```json
{
  "session_id": "string",
  "booking_id": "string",
  "student_id": "string",
  "teacher_id": "string",
  "start_time": "ISO-8601 timestamp",
  "end_time": "ISO-8601 timestamp",
  "status": "pending|active|completed",
  "meeting_data": {},
  "notes": [],
  "files": []
}
```

#### POST /sessions
Creates a new virtual session for a booking.

**Request Body:**
```json
{
  "booking_id": "string"
}
```

**Response:**
```json
{
  "session_id": "string",
  "message": "Session created successfully"
}
```

#### PUT /sessions/{id}
Updates a session with notes, shared documents, or status changes.

**Path Parameters:**
- `id` (required): The unique identifier of the session

**Request Body:**
```json
{
  "status": "pending|active|completed",
  "notes": [{ "text": "string", "timestamp": "ISO-8601 timestamp" }],
  "files": [{ "name": "string", "url": "string", "timestamp": "ISO-8601 timestamp" }]
}
```

**Response:**
```json
{
  "message": "Session updated successfully"
}
```

### Video Meeting Management (Amazon Chime)

#### POST /meetings
Creates a new Amazon Chime meeting for a session.

**Request Body:**
```json
{
  "session_id": "string"
}
```

**Response:**
```json
{
  "meeting_id": "string",
  "meeting_data": {}
}
```

#### GET /meetings/{session_id}
Gets the details of a Chime meeting for a session.

**Path Parameters:**
- `session_id` (required): The unique identifier of the session

**Response:**
```json
{
  "meeting_id": "string",
  "meeting_data": {}
}
```

#### DELETE /meetings
Ends an active Chime meeting for a session.

**Request Body:**
```json
{
  "meeting_id": "string"
}
```

**Response:**
```json
{
  "message": "Meeting ended successfully"
}
```

#### POST /attendees
Creates a new attendee for an existing Chime meeting.

**Request Body:**
```json
{
  "meeting_id": "string",
  "user_id": "string",
  "name": "string"
}
```

**Response:**
```json
{
  "attendee_id": "string",
  "attendee_data": {}
}
```

### Search Functionality

#### GET /search/teachers
Searches for teachers based on topic/subject.

**Query Parameters:**
- `topic` (required): The topic or subject to search for

**Response:**
```json
[
  {
    "user_id": "string",
    "name": "string",
    "bio": "string",
    "topics": ["string"],
    "rating": number
  }
]
```

### File Upload

#### POST /presigned-url
Generates a pre-signed URL for S3 uploads of profile photos or documents.

**Request Body:**
```json
{
  "file_name": "string",
  "content_type": "string"
}
```

**Response:**
```json
{
  "upload_url": "string",
  "file_url": "string"
}
```

## Error Responses

All API endpoints return standard HTTP status codes. In case of an error, the response body will contain more details:

```json
{
  "error": "string",
  "message": "string",
  "status_code": number
}
```

Common error codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error