import json
import boto3
import uuid
import os
from datetime import datetime
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError
from decimal import Decimal

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
dynamodb_client = boto3.client('dynamodb')
# Use chime-sdk-meetings instead of the legacy chime service
chime_client = boto3.client('chime-sdk-meetings')

# Get environment stage, default to prod
stage = os.environ.get('STAGE', 'prod')

# Create stage-specific table names
SERVICE_TABLE = f'ServiceCatalog-{stage}'
BOOKINGS_TABLE = f'Bookings-{stage}'
PROFILE_TABLE = f'UserProfiles-{stage}'
AVAILABILITY_TABLE = f'TeacherAvailability-{stage}'
SESSION_TABLE = f'Sessions-{stage}'

# ========== Utility Functions ==========
def convert_decimal(obj):
    """Recursively converts DynamoDB decimal types to Python floats."""
    if isinstance(obj, list):
        return [convert_decimal(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj)
    return obj

def response_with_cors(status_code, body):
    """Utility to return responses with CORS headers."""
    response = {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",  # Allow any origin for development, restrict to domain in production
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token",
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }

    # Log response details based on status code
    if status_code >= 500:
        # Server error responses
        print(f"[ERROR] Server error response {status_code}: {json.dumps(body, default=str)}")
    elif status_code >= 400:
        # Client error responses
        print(f"[WARN] Client error response {status_code}: {json.dumps(body, default=str)}")
    elif status_code >= 300:
        # Redirection responses
        print(f"[INFO] Redirect response {status_code}")
    elif status_code >= 200:
        # Success responses - include response body for /availability endpoints to aid debugging
        if body and isinstance(body, dict):
            # For availability-related endpoints, log more details even for success
            if 'availability_id' in body or (isinstance(body, list) and body and 'availability_id' in body[0]):
                print(f"[INFO] Availability success response {status_code}: {json.dumps(body, default=str)}")
            else:
                print(f"[INFO] Success response {status_code}")
        else:
            print(f"[INFO] Success response {status_code}")
    else:
        # Information responses
        print(f"[INFO] Informational response {status_code}")

    return response

# Tables are created by CloudFormation, not by Lambda code
# This improves Lambda cold-start performance and separates concerns

# ========== Profile Management ==========
def get_user_profile(event):
    """Fetches a user profile from the UserProfiles table."""
    try:
        # Log the full event for debugging
        print(f"GET profile event: {json.dumps(event)}")

        # Get query parameters - handle both regular and path-based API Gateway configs
        query_params = event.get('queryStringParameters', {}) or {}

        # Check if query parameters is None (can happen with API Gateway)
        if query_params is None:
            query_params = {}

        user_id = query_params.get('user_id')

        # If user_id is not in query parameters, check if it's in pathParameters
        if not user_id and event.get('pathParameters'):
            user_id = event.get('pathParameters', {}).get('user_id')

        # As a last resort, try to extract from the path directly
        if not user_id and 'path' in event:
            path_parts = event['path'].split('/')
            if len(path_parts) > 2 and path_parts[1] == 'profiles':
                user_id = path_parts[2]  # Assuming path format like /profiles/{user_id}

        print(f"Looking up profile for user_id: {user_id}")

        if not user_id:
            return response_with_cors(400, {"message": "user_id is required to fetch the profile."})

        try:
            # Use only the stage-specific table name (e.g. UserProfiles-prod)
            print(f"Looking up profile in table: {PROFILE_TABLE}")
            table = dynamodb.Table(PROFILE_TABLE)

            # Use ConsistentRead for the most up-to-date data
            response = table.get_item(Key={'user_id': user_id}, ConsistentRead=True)

            # Log response for debugging
            if 'Item' in response:
                print(f"Found user profile for {user_id}")
            else:
                print(f"No profile found for user {user_id}")

        except Exception as table_error:
            print(f"Error accessing table {PROFILE_TABLE}: {str(table_error)}")
            return response_with_cors(500, {"message": "Error accessing user profiles database.", "error": str(table_error)})

        if 'Item' not in response:
            return response_with_cors(404, {"message": "User profile not found."})

        profile_data = convert_decimal(response['Item'])
        return response_with_cors(200, {"profile": profile_data})

    except Exception as e:
        error_msg = str(e)
        print(f"Error in get_user_profile: {error_msg}")
        return response_with_cors(500, {"message": "Error fetching profile.", "error": error_msg})

def create_user_profile(event):
    """Creates or updates a user profile in the UserProfiles table."""
    try:
        print(f"Processing profile creation request: {json.dumps(event, default=str)}")

        # Check if the body exists and is not empty
        if not event.get('body'):
            print("Error: Empty request body")
            return response_with_cors(400, {"message": "Request body is required."})

        # Parse the body with error handling
        try:
            body = json.loads(event['body'])
            print(f"Parsed request body: {json.dumps(body, default=str)}")
        except json.JSONDecodeError as json_error:
            print(f"Error decoding JSON body: {str(json_error)}, Body: {event.get('body', 'None')}")
            return response_with_cors(400, {"message": "Invalid JSON in request body."})

        # Get user_id and role from body
        user_id = body.get('user_id')
        role = body.get('role')

        # Get profile data, which could be direct or nested
        if 'profile_data' in body:
            # Frontend sends nested profile_data
            profile_data = body.get('profile_data', {})
        else:
            # Direct profile data without nesting
            profile_data = body

        print(f"Profile creation for user_id: {user_id}, role: {role}, data: {json.dumps(profile_data, default=str)}")

        if not user_id:
            print("Error: Missing user_id in request")
            return response_with_cors(400, {"message": "user_id is required to create or update profile."})

        # Create profile item with timestamps
        timestamp = datetime.utcnow().isoformat()
        profile_item = {
            'user_id': user_id,
            'created_at': timestamp,
            'updated_at': timestamp,
        }

        # Add role if provided
        if role:
            profile_item['role'] = role

        # Add all other profile data
        for key, value in profile_data.items():
            if key not in ['user_id', 'created_at', 'updated_at'] and key != 'profile_data':
                profile_item[key] = value

        # Check if profile already exists
        table = dynamodb.Table(PROFILE_TABLE)
        print(f"Checking if user already exists in table: {PROFILE_TABLE}")
        try:
            get_response = table.get_item(Key={'user_id': user_id})
            existing_profile = get_response.get('Item')
            if existing_profile:
                print(f"Existing profile found for {user_id}, updating")
                profile_item['created_at'] = existing_profile['created_at']
            else:
                print(f"No existing profile for {user_id}, creating new")
        except Exception as get_error:
            print(f"Error checking for existing profile: {str(get_error)}")
            # Continue with creation even if check fails

        # Save the profile
        print(f"Saving profile to table {PROFILE_TABLE}: {json.dumps(profile_item, default=str)}")
        try:
            put_response = table.put_item(Item=profile_item)
            print(f"Profile saved successfully: {json.dumps(put_response, default=str)}")
            return response_with_cors(201, {"message": "User profile created/updated successfully.", "profile": profile_item})
        except Exception as put_error:
            print(f"Error saving profile: {str(put_error)}")
            return response_with_cors(500, {"message": "Error saving profile to database.", "error": str(put_error)})

    except Exception as e:
        print(f"Unexpected error in create_user_profile: {str(e)}")
        return response_with_cors(500, {"message": "Error processing profile data.", "error": str(e)})

# ========== Service Management ==========
def create_service(event):
    """Creates a new service in the ServiceCatalog table."""
    try:
        body = json.loads(event['body'])
        expert_id = body['expert_id']
        service_id = f"{expert_id}-{int(datetime.utcnow().timestamp())}"

        new_service = {
            'service_id': service_id,
            **body
        }
        dynamodb.Table(SERVICE_TABLE).put_item(Item=new_service)
        return response_with_cors(201, {"message": "Service created successfully", "service_id": service_id})
    except (ClientError, json.JSONDecodeError) as e:
        return response_with_cors(500, {"message": "Error creating service.", "error": str(e)})

def get_services(event):
    """Retrieves services from the ServiceCatalog table."""
    try:
        table = dynamodb.Table(SERVICE_TABLE)
        response = table.scan()
        services = convert_decimal(response['Items'])
        return response_with_cors(200, services)
    except ClientError as e:
        return response_with_cors(500, {"message": "Error fetching services.", "error": str(e)})

# ========== Booking Management ==========
def create_booking(event):
    """Creates a booking in the Bookings table."""
    try:
        body = json.loads(event['body'])

        # Validate required fields
        required_fields = ['student_id', 'availability_id']
        for field in required_fields:
            if field not in body:
                return response_with_cors(400, {"message": f"Missing required field: {field}"})

        # Generate a unique booking ID
        booking_id = f"booking-{uuid.uuid4()}"
        timestamp = datetime.utcnow().isoformat()

        # Get the availability record
        availability_table = dynamodb.Table(AVAILABILITY_TABLE)
        availability_response = availability_table.get_item(
            Key={'availability_id': body['availability_id']}
        )

        if 'Item' not in availability_response:
            return response_with_cors(404, {"message": "Availability slot not found"})

        availability = availability_response['Item']

        # Check if the slot is available
        if availability['status'] != 'available':
            return response_with_cors(400, {"message": "This time slot is no longer available"})

        # Create the booking
        new_booking = {
            'booking_id': booking_id,
            'student_id': body['student_id'],
            'teacher_id': availability['teacher_id'],
            'start_time': availability['start_time'],
            'end_time': availability['end_time'],
            'topic': availability['topic'],
            'status': 'booked',
            'created_at': timestamp,
        }

        # Add any additional booking data
        for key, value in body.items():
            if key not in new_booking and key != 'availability_id':
                new_booking[key] = value

        # Create the booking
        bookings_table = dynamodb.Table(BOOKINGS_TABLE)
        bookings_table.put_item(Item=new_booking)

        # Update the availability status to 'booked'
        availability_table.update_item(
            Key={'availability_id': body['availability_id']},
            UpdateExpression="SET #status = :status",
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':status': 'booked'
            }
        )

        return response_with_cors(201, {
            "message": "Booking created successfully",
            "booking_id": booking_id,
            "booking": new_booking
        })
    except (ClientError, json.JSONDecodeError) as e:
        return response_with_cors(500, {"message": "Error creating booking.", "error": str(e)})

def get_bookings(event):
    """Retrieves bookings from the Bookings table."""
    try:
        query_params = event.get('queryStringParameters', {})
        table = dynamodb.Table(BOOKINGS_TABLE)

        # Check if filtering by student_id or teacher_id
        if 'student_id' in query_params:
            # Get bookings for a specific student
            filtered_bookings = table.scan(
                FilterExpression=Attr('student_id').eq(query_params['student_id'])
            )
            bookings = filtered_bookings['Items']
        elif 'teacher_id' in query_params:
            # Get bookings for a specific teacher
            filtered_bookings = table.scan(
                FilterExpression=Attr('teacher_id').eq(query_params['teacher_id'])
            )
            bookings = filtered_bookings['Items']
        else:
            # Get all bookings
            response = table.scan()
            bookings = response['Items']

        return response_with_cors(200, convert_decimal(bookings))
    except ClientError as e:
        return response_with_cors(500, {"message": "Error fetching bookings.", "error": str(e)})

# ========== Availability Management ==========
def create_availability(event):
    """Creates a new availability slot for a teacher."""
    try:
        print(f"[TRACE] create_availability called with event: {json.dumps(event, default=str)}")
        
        # Parse the body with error handling
        try:
            body = json.loads(event['body'])
            print(f"[TRACE] Parsed request body: {json.dumps(body, default=str)}")
        except json.JSONDecodeError as json_error:
            print(f"[ERROR] Error decoding JSON body: {str(json_error)}, Body: {event.get('body', 'None')}")
            return response_with_cors(400, {"message": "Invalid JSON in request body."})

        # Validate required fields
        required_fields = ['teacher_id', 'start_time', 'end_time']
        for field in required_fields:
            if field not in body:
                print(f"[ERROR] Missing required field in request: {field}")
                return response_with_cors(400, {"message": f"Missing required field: {field}"})
        
        print(f"[TRACE] Required fields validation passed")

        # Generate a unique availability ID
        availability_id = f"avail-{uuid.uuid4()}"
        timestamp = datetime.utcnow().isoformat()
        print(f"[TRACE] Generated availability_id: {availability_id}")

        # Create the availability record
        new_availability = {
            'availability_id': availability_id,
            'teacher_id': body['teacher_id'],
            'start_time': body['start_time'],
            'end_time': body['end_time'],
            'topic': body.get('topic', ''),  # Topic is now optional
            'description': body.get('description', ''),
            'status': 'available',
            'created_at': timestamp,
        }
        
        print(f"[TRACE] Created base availability record: {json.dumps(new_availability, default=str)}")

        # Add any additional availability data
        additional_fields = []
        for key, value in body.items():
            if key not in new_availability:
                new_availability[key] = value
                additional_fields.append(key)
        
        if additional_fields:
            print(f"[TRACE] Added additional fields to availability record: {', '.join(additional_fields)}")

        # Store in DynamoDB
        try:
            print(f"[TRACE] Storing availability in DynamoDB table: {AVAILABILITY_TABLE}")
            availability_table = dynamodb.Table(AVAILABILITY_TABLE)
            result = availability_table.put_item(Item=new_availability)
            print(f"[TRACE] DynamoDB put_item result: {json.dumps(result, default=str)}")
        except ClientError as db_error:
            print(f"[ERROR] DynamoDB error creating availability: {str(db_error)}")
            return response_with_cors(500, {"message": "Database error creating availability slot.", "error": str(db_error)})

        print(f"[TRACE] Successfully created availability slot: {availability_id}")
        return response_with_cors(201, {
            "message": "Availability slot created successfully",
            "availability_id": availability_id,
            "availability": new_availability
        })
    except (ClientError, json.JSONDecodeError) as e:
        print(f"[ERROR] Exception in create_availability: {str(e)}")
        return response_with_cors(500, {"message": "Error creating availability slot.", "error": str(e)})
    except Exception as unexpected_error:
        print(f"[ERROR] Unexpected error in create_availability: {str(unexpected_error)}")
        return response_with_cors(500, {"message": "Unexpected error creating availability slot.", "error": str(unexpected_error)})

def get_availabilities(event):
    """Retrieves availability slots."""
    try:
        query_params = event.get('queryStringParameters', {})
        table = dynamodb.Table(AVAILABILITY_TABLE)

        # Check if filtering by teacher_id
        if 'teacher_id' in query_params:
            # Get availability for a specific teacher
            response = table.scan(
                FilterExpression=Attr('teacher_id').eq(query_params['teacher_id'])
            )
            availabilities = response['Items']
        else:
            # Get all available slots (for student search)
            response = table.scan(
                FilterExpression=Attr('status').eq('available')
            )
            availabilities = response['Items']

        return response_with_cors(200, convert_decimal(availabilities))
    except ClientError as e:
        return response_with_cors(500, {"message": "Error fetching availability slots.", "error": str(e)})

def delete_availability(event):
    """Deletes an availability slot."""
    try:
        availability_id = event.get('pathParameters', {}).get('id')

        if not availability_id:
            return response_with_cors(400, {"message": "Missing availability ID"})

        # Check if the availability exists
        table = dynamodb.Table(AVAILABILITY_TABLE)
        response = table.get_item(Key={'availability_id': availability_id})

        if 'Item' not in response:
            return response_with_cors(404, {"message": "Availability slot not found"})

        availability = response['Item']

        # Only delete if status is 'available'
        if availability['status'] != 'available':
            return response_with_cors(400, {"message": "Cannot delete a booked availability slot"})

        # Delete the availability
        table.delete_item(Key={'availability_id': availability_id})

        return response_with_cors(200, {"message": "Availability slot deleted successfully"})
    except ClientError as e:
        return response_with_cors(500, {"message": "Error deleting availability slot.", "error": str(e)})

# ========== Session Management ==========
def create_session(event):
    """Creates a new virtual session."""
    try:
        body = json.loads(event['body'])

        # Validate required fields
        required_fields = ['booking_id', 'teacher_id', 'student_id']
        for field in required_fields:
            if field not in body:
                return response_with_cors(400, {"message": f"Missing required field: {field}"})

        # Generate a unique session ID
        session_id = f"session-{uuid.uuid4()}"
        timestamp = datetime.utcnow().isoformat()

        # Create the session record
        new_session = {
            'session_id': session_id,
            'booking_id': body['booking_id'],
            'teacher_id': body['teacher_id'],
            'student_id': body['student_id'],
            'start_time': body.get('start_time', timestamp),
            'status': 'active',
            'recording_url': '',
            'notes': [],
            'shared_documents': [],
            'created_at': timestamp,
        }

        # Add any additional session data
        for key, value in body.items():
            if key not in new_session:
                new_session[key] = value

        # Store in DynamoDB
        session_table = dynamodb.Table(SESSION_TABLE)
        session_table.put_item(Item=new_session)

        return response_with_cors(201, {
            "message": "Session created successfully",
            "session_id": session_id,
            "session": new_session
        })
    except (ClientError, json.JSONDecodeError) as e:
        return response_with_cors(500, {"message": "Error creating session.", "error": str(e)})

def get_session(event):
    """Retrieves a specific session."""
    try:
        session_id = event.get('pathParameters', {}).get('id')

        if not session_id:
            return response_with_cors(400, {"message": "Missing session ID"})

        # Get the session
        table = dynamodb.Table(SESSION_TABLE)
        response = table.get_item(Key={'session_id': session_id})

        if 'Item' not in response:
            return response_with_cors(404, {"message": "Session not found"})

        session = convert_decimal(response['Item'])

        return response_with_cors(200, session)
    except ClientError as e:
        return response_with_cors(500, {"message": "Error fetching session.", "error": str(e)})

def update_session(event):
    """Updates a session with notes, documents, or recording URL."""
    try:
        session_id = event.get('pathParameters', {}).get('id')

        if not session_id:
            return response_with_cors(400, {"message": "Missing session ID"})

        body = json.loads(event['body'])

        # Get the current session
        table = dynamodb.Table(SESSION_TABLE)
        response = table.get_item(Key={'session_id': session_id})

        if 'Item' not in response:
            return response_with_cors(404, {"message": "Session not found"})

        # Prepare update expressions based on what's provided
        update_expression = "SET "
        expression_names = {}
        expression_values = {}

        # Handle notes (append to existing)
        if 'note' in body:
            new_note = {
                'text': body['note'],
                'timestamp': datetime.utcnow().isoformat(),
                'author_id': body.get('author_id', 'unknown')
            }
            update_expression += "#notes = list_append(if_not_exists(#notes, :empty_list), :new_note), "
            expression_names["#notes"] = "notes"
            expression_values[":empty_list"] = []
            expression_values[":new_note"] = [new_note]

        # Handle shared documents (append to existing)
        if 'document' in body:
            new_document = {
                'url': body['document'],
                'name': body.get('document_name', 'Untitled'),
                'timestamp': datetime.utcnow().isoformat(),
                'author_id': body.get('author_id', 'unknown')
            }
            update_expression += "#docs = list_append(if_not_exists(#docs, :empty_list), :new_doc), "
            expression_names["#docs"] = "shared_documents"
            expression_values[":empty_list"] = []
            expression_values[":new_doc"] = [new_document]

        # Handle recording URL (replace)
        if 'recording_url' in body:
            update_expression += "#rec = :rec, "
            expression_names["#rec"] = "recording_url"
            expression_values[":rec"] = body['recording_url']

        # Handle status change
        if 'status' in body:
            update_expression += "#status = :status, "
            expression_names["#status"] = "status"
            expression_values[":status"] = body['status']

        # Check if any updates were provided
        if update_expression == "SET ":
            return response_with_cors(400, {"message": "No updates provided"})

        # Remove trailing comma and space
        update_expression = update_expression[:-2]

        # Update the session
        table.update_item(
            Key={'session_id': session_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values,
            ReturnValues="ALL_NEW"
        )

        # Get the updated session
        updated_response = table.get_item(Key={'session_id': session_id})
        updated_session = convert_decimal(updated_response['Item'])

        return response_with_cors(200, {
            "message": "Session updated successfully",
            "session": updated_session
        })
    except (ClientError, json.JSONDecodeError) as e:
        return response_with_cors(500, {"message": "Error updating session.", "error": str(e)})

# ========== S3 Presigned URLs ==========
def generate_presigned_url(event):
    """Generates a pre-signed URL for S3 uploads."""
    try:
        body = json.loads(event.get('body', '{}'))
        file_type = body.get('file_type', 'image/jpeg')
        file_name = body.get('file_name', f"image-{uuid.uuid4()}.jpg")

        # Initialize S3 client
        s3_client = boto3.client('s3')

        # Define the bucket and key
        bucket_name = 'sessionsred-uploads-prod'  # Production bucket name
        key = f"profile-photos/{file_name}"

        # Generate pre-signed URL for PUT operation
        # Remove ACL parameter which can cause 400 Bad Request if bucket doesn't allow ACL settings
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': key,
                'ContentType': file_type
                # 'ACL': 'public-read' - Removed to prevent 400 Bad Request
            },
            ExpiresIn=300  # URL expires in 5 minutes
        )

        # Construct the public URL that will be accessible after upload
        # Use the S3 URL format with region - this is more reliable
        region = boto3.session.Session().region_name or 'us-east-1'
        public_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{key}"

        return response_with_cors(200, {
            'upload_url': presigned_url,
            'public_url': public_url
        })
    except Exception as e:
        print(f"Error generating presigned URL: {str(e)}")
        return response_with_cors(500, {"message": "Error generating upload URL", "error": str(e)})

# ========== Video Meeting Management ==========
def create_chime_meeting(event):
    """Creates a new Amazon Chime meeting for a session."""
    try:
        body = json.loads(event['body'])
        session_id = body.get('session_id')

        if not session_id:
            return response_with_cors(400, {"message": "session_id is required"})

        # Get the session to verify it exists
        sessions_table = dynamodb.Table(SESSION_TABLE)
        session_response = sessions_table.get_item(Key={'session_id': session_id})

        if 'Item' not in session_response:
            return response_with_cors(404, {"message": "Session not found"})

        session = session_response['Item']

        # Create a unique meeting ID based on the session
        external_meeting_id = f"session-meeting-{session_id}"

        # Check if a meeting already exists for this session
        try:
            # Try to get an existing meeting
            existing_meeting = chime_client.get_meeting(
                MeetingId=session.get('chime_meeting_id', '')
            )

            # If we got here, the meeting exists and is active
            return response_with_cors(200, {
                "meeting": existing_meeting['Meeting'],
                "session_id": session_id
            })
        except (chime_client.exceptions.NotFoundException, chime_client.exceptions.BadRequestException, chime_client.exceptions.ForbiddenException):
            # Meeting doesn't exist or invalid ID, create a new one
            print(f"Meeting not found or not valid, creating a new one")
            pass
        except Exception as e:
            # Some other error occurred, likely the meeting_id is invalid
            # We'll create a new meeting
            print(f"Error getting existing meeting: {str(e)}")

        # Create a new Chime meeting with meeting features
        try:
            meeting_response = chime_client.create_meeting(
                ClientRequestToken=str(uuid.uuid4()),
                ExternalMeetingId=external_meeting_id,
                MediaRegion='us-east-1',  # Specify your preferred region
                MeetingFeatures={
                    'Audio': {
                        'EchoReduction': 'AVAILABLE'
                    },
                    'Video': {
                        'MaxResolution': 'HD'
                    },
                    'Content': {
                        'MaxResolution': 'FHD'
                    }
                }
            )
            print(f"Successfully created meeting with features: {json.dumps(meeting_response, default=str)}")
        except Exception as e:
            print(f"Error creating meeting with features: {str(e)}")
            # Fallback to basic meeting if features are not supported
            meeting_response = chime_client.create_meeting(
                ClientRequestToken=str(uuid.uuid4()),
                ExternalMeetingId=external_meeting_id,
                MediaRegion='us-east-1'  # Specify your preferred region
            )
            print(f"Created basic meeting without features: {json.dumps(meeting_response, default=str)}")

        # Update the session with the Chime meeting ID
        sessions_table.update_item(
            Key={'session_id': session_id},
            UpdateExpression="SET chime_meeting_id = :meeting_id, chime_meeting_data = :meeting_data",
            ExpressionAttributeValues={
                ':meeting_id': meeting_response['Meeting']['MeetingId'],
                ':meeting_data': json.dumps(meeting_response['Meeting'])
            }
        )

        return response_with_cors(201, {
            "meeting": meeting_response['Meeting'],
            "session_id": session_id
        })
    except (ClientError, json.JSONDecodeError) as e:
        print(f"Error creating Chime meeting: {str(e)}")
        return response_with_cors(500, {"message": "Error creating video meeting.", "error": str(e)})

def create_chime_attendee(event):
    """Creates a new attendee for an existing Chime meeting."""
    try:
        body = json.loads(event['body'])
        session_id = body.get('session_id')
        user_id = body.get('user_id')

        if not session_id or not user_id:
            return response_with_cors(400, {"message": "session_id and user_id are required"})

        # Get the session to verify it exists and get the meeting ID
        sessions_table = dynamodb.Table(SESSION_TABLE)
        session_response = sessions_table.get_item(Key={'session_id': session_id})

        if 'Item' not in session_response:
            return response_with_cors(404, {"message": "Session not found"})

        session = session_response['Item']
        meeting_id = session.get('chime_meeting_id')

        if not meeting_id:
            return response_with_cors(400, {"message": "No active meeting for this session"})

        # Verify the user is either the teacher or student for this session
        if user_id != session['teacher_id'] and user_id != session['student_id']:
            return response_with_cors(403, {"message": "User is not authorized to join this session"})

        # Get user profile to include name
        profiles_table = dynamodb.Table(PROFILE_TABLE)
        profile_response = profiles_table.get_item(Key={'user_id': user_id})

        if 'Item' in profile_response:
            user_name = profile_response['Item'].get('name', 'Participant')
        else:
            user_name = 'Participant'

        # Create an attendee with the new SDK
        try:
            attendee_response = chime_client.create_attendee(
                MeetingId=meeting_id,
                ExternalUserId=user_id,
                Capabilities={
                    'Audio': 'SendReceive',
                    'Video': 'SendReceive',
                    'Content': 'SendReceive'
                }
            )
        except Exception as e:
            print(f"Error creating attendee with capabilities: {str(e)}")
            # Fallback to basic attendee creation without capabilities if needed
            attendee_response = chime_client.create_attendee(
                MeetingId=meeting_id,
                ExternalUserId=user_id
            )

        return response_with_cors(201, {
            "attendee": attendee_response['Attendee'],
            "meeting_id": meeting_id,
            "user_name": user_name
        })
    except (ClientError, json.JSONDecodeError) as e:
        print(f"Error creating Chime attendee: {str(e)}")
        return response_with_cors(500, {"message": "Error joining video meeting.", "error": str(e)})

def get_chime_meeting(event):
    """Gets the details of a Chime meeting for a session."""
    try:
        session_id = event.get('pathParameters', {}).get('session_id')

        if not session_id:
            # Try to extract from query parameters
            session_id = event.get('queryStringParameters', {}).get('session_id')

        if not session_id:
            return response_with_cors(400, {"message": "session_id is required"})

        # Get the session to verify it exists
        sessions_table = dynamodb.Table(SESSION_TABLE)
        session_response = sessions_table.get_item(Key={'session_id': session_id})

        if 'Item' not in session_response:
            return response_with_cors(404, {"message": "Session not found"})

        session = session_response['Item']

        # If meeting data is stored in the session, return it
        if 'chime_meeting_data' in session:
            try:
                meeting_data = json.loads(session['chime_meeting_data'])
                return response_with_cors(200, {
                    "meeting": meeting_data,
                    "session_id": session_id,
                    "has_active_meeting": True
                })
            except (json.JSONDecodeError, TypeError):
                # If the stored data is invalid, we'll try to get it from Chime
                pass

        # If we have a meeting ID but no data, try to get it from Chime
        if 'chime_meeting_id' in session:
            try:
                meeting_response = chime_client.get_meeting(
                    MeetingId=session['chime_meeting_id']
                )

                # Update the session with the latest meeting data
                sessions_table.update_item(
                    Key={'session_id': session_id},
                    UpdateExpression="SET chime_meeting_data = :meeting_data",
                    ExpressionAttributeValues={
                        ':meeting_data': json.dumps(meeting_response['Meeting'])
                    }
                )

                return response_with_cors(200, {
                    "meeting": meeting_response['Meeting'],
                    "session_id": session_id,
                    "has_active_meeting": True
                })
            except (chime_client.exceptions.NotFoundException, chime_client.exceptions.BadRequestException, chime_client.exceptions.ForbiddenException):
                # Meeting doesn't exist anymore
                return response_with_cors(200, {
                    "session_id": session_id,
                    "has_active_meeting": False,
                    "message": "No active meeting found for this session"
                })
            except Exception as e:
                print(f"Error getting Chime meeting: {str(e)}")
                # We'll return a response indicating no active meeting
                return response_with_cors(200, {
                    "session_id": session_id,
                    "has_active_meeting": False,
                    "message": "Error retrieving meeting information"
                })

        # No meeting exists for this session
        return response_with_cors(200, {
            "session_id": session_id,
            "has_active_meeting": False,
            "message": "No meeting has been created for this session yet"
        })
    except Exception as e:
        print(f"Error in get_chime_meeting: {str(e)}")
        return response_with_cors(500, {"message": "Error getting meeting information.", "error": str(e)})

def end_chime_meeting(event):
    """Ends an active Chime meeting for a session."""
    try:
        body = json.loads(event['body'])
        session_id = body.get('session_id')

        if not session_id:
            return response_with_cors(400, {"message": "session_id is required"})

        # Get the session to verify it exists
        sessions_table = dynamodb.Table(SESSION_TABLE)
        session_response = sessions_table.get_item(Key={'session_id': session_id})

        if 'Item' not in session_response:
            return response_with_cors(404, {"message": "Session not found"})

        session = session_response['Item']

        # Check if there's an active meeting
        if 'chime_meeting_id' not in session:
            return response_with_cors(400, {"message": "No active meeting for this session"})

        meeting_id = session['chime_meeting_id']

        # End the meeting with the new SDK
        try:
            chime_client.delete_meeting(
                MeetingId=meeting_id
            )

            # Update the session to remove meeting data
            sessions_table.update_item(
                Key={'session_id': session_id},
                UpdateExpression="REMOVE chime_meeting_id, chime_meeting_data"
            )

            return response_with_cors(200, {
                "message": "Meeting ended successfully",
                "session_id": session_id
            })
        except (chime_client.exceptions.NotFoundException, chime_client.exceptions.BadRequestException, chime_client.exceptions.ForbiddenException):
            # Meeting doesn't exist anymore or is invalid, just update the session
            print(f"Meeting not found or already ended, cleaning up session data")
            sessions_table.update_item(
                Key={'session_id': session_id},
                UpdateExpression="REMOVE chime_meeting_id, chime_meeting_data"
            )

            return response_with_cors(200, {
                "message": "Meeting was already ended",
                "session_id": session_id
            })
        except Exception as e:
            print(f"Error ending Chime meeting: {str(e)}")
            return response_with_cors(500, {"message": "Error ending meeting.", "error": str(e)})
    except (ClientError, json.JSONDecodeError) as e:
        print(f"Error in end_chime_meeting: {str(e)}")
        return response_with_cors(500, {"message": "Error processing request.", "error": str(e)})

# ========== Search ==========
def search_teachers(event):
    """Searches for teachers based on topic/subject or teacher name."""
    try:
        query_params = event.get('queryStringParameters', {})
        search_query = query_params.get('topic', '').lower()  # Keeping parameter name as 'topic' for backward compatibility
        search_type = query_params.get('type', 'both').lower()  # 'topic', 'name', or 'both'

        if not search_query:
            return response_with_cors(400, {"message": "Missing search query"})

        # Log search parameters
        print(f"Searching for teachers with query: '{search_query}', type: '{search_type}'")
        
        # Search for teachers who offer this topic or match the name
        profile_table = dynamodb.Table(PROFILE_TABLE)
        response = profile_table.scan(
            FilterExpression=Attr('role').eq('teacher')
        )

        teachers = []
        for teacher in response['Items']:
            match_found = False
            
            # For debugging
            teacher_name = teacher.get('name', '').lower()
            teacher_topics = [t.lower() for t in teacher.get('topics', [])]
            
            # Search by topic
            if search_type in ['topic', 'both'] and 'topics' in teacher:
                if any(search_query in topic.lower() for topic in teacher['topics']):
                    match_found = True
                    print(f"Teacher matched by topic: {teacher.get('name', 'Unknown')}, topics: {teacher_topics}")
            
            # Search by name
            if search_type in ['name', 'both'] and 'name' in teacher:
                if search_query in teacher['name'].lower():
                    match_found = True
                    print(f"Teacher matched by name: {teacher_name}")
            
            if match_found:
                teachers.append(teacher)

        print(f"Found {len(teachers)} matching teachers")
        return response_with_cors(200, convert_decimal(teachers))
    except ClientError as e:
        print(f"Error in search_teachers: {str(e)}")
        return response_with_cors(500, {"message": "Error searching for teachers.", "error": str(e)})

# ========== Lambda Handler ==========
def get_booking_session(event):
    """Retrieves the session associated with a booking."""
    try:
        # Log the full event for debugging
        print(f"get_booking_session called with event: {json.dumps(event, default=str)}")

        # First try to get booking_id from path parameters (check both formats)
        path_params = event.get('pathParameters', {}) or {}
        booking_id = path_params.get('booking_id')
        if not booking_id:
            booking_id = path_params.get('booking-id')
        print(f"Initial booking_id from pathParameters: {booking_id}")

        if not booking_id:
            # Try to extract from the path as a fallback
            path = event.get('path', '')
            print(f"Extracting booking_id from path: {path}")

            path_parts = path.split('/')
            for i, part in enumerate(path_parts):
                if part == 'bookings' and i + 1 < len(path_parts):
                    booking_id = path_parts[i + 1]
                    print(f"Extracted booking_id from path: {booking_id}")
                    break

        if not booking_id:
            print("Failed to extract booking_id from request")
            return response_with_cors(400, {"message": "Missing booking ID"})

        # Remove any additional path parts or query parameters from booking_id
        if '/' in booking_id:
            booking_id_parts = booking_id.split('/')
            booking_id = booking_id_parts[0]
            print(f"Stripped path from booking_id: {booking_id}")

        if '?' in booking_id:
            booking_id_parts = booking_id.split('?')
            booking_id = booking_id_parts[0]
            print(f"Stripped query from booking_id: {booking_id}")

        print(f"Final booking_id for lookup: {booking_id}")

        # First verify the booking exists
        bookings_table = dynamodb.Table(BOOKINGS_TABLE)
        booking_response = bookings_table.get_item(Key={'booking_id': booking_id})

        if 'Item' not in booking_response:
            return response_with_cors(404, {"message": "Booking not found"})

        booking = booking_response['Item']

        # Then look for sessions associated with this booking
        sessions_table = dynamodb.Table(SESSION_TABLE)
        session_response = sessions_table.scan(
            FilterExpression=Attr('booking_id').eq(booking_id)
        )

        if not session_response['Items']:
            # No session exists yet, but return a structured response instead of 404
            # This way frontend knows it's a valid booking but without a session
            return response_with_cors(200, {
                "booking_id": booking_id,
                "session_exists": False,
                "message": "No session exists for this booking yet"
            })

        # Return the first (and hopefully only) session
        session = convert_decimal(session_response['Items'][0])
        session["session_exists"] = True

        return response_with_cors(200, session)
    except ClientError as e:
        print(f"Database error in get_booking_session: {str(e)}")
        return response_with_cors(500, {"message": "Error fetching booking session.", "error": str(e)})
    except Exception as e:
        print(f"Unexpected error in get_booking_session: {str(e)}")
        return response_with_cors(500, {"message": "Error processing request", "error": str(e)})

def lambda_handler(event, context):
    """Main Lambda entry point to handle incoming requests."""
    # Log request info and environment details for debugging
    print(f"Sessions API request: {event.get('path', '')} [{event.get('httpMethod', 'DIRECT')}]")
    print(f"Lambda v{context.function_version} [{os.environ.get('BUILD_VERSION', 'undefined')}], alias: {os.environ.get('AWS_LAMBDA_FUNCTION_ALIAS', 'undefined')}")

    # Only log table names during cold start to reduce noise
    # Check if this is likely a cold start by using environment variable timestamp
    if not hasattr(lambda_handler, 'initialized'):
        try:
            # List only the tables we expect to use, no need to list all tables
            expected_tables = [PROFILE_TABLE, BOOKINGS_TABLE, SERVICE_TABLE, AVAILABILITY_TABLE, SESSION_TABLE]
            print(f"Using tables: {expected_tables}")
            lambda_handler.initialized = True
        except Exception as e:
            print(f"Error during initialization: {str(e)}")

    try:
        # Handle direct invocations or API Gateway proxied requests
        if 'httpMethod' not in event:
            # This is likely a direct Lambda invocation, handle accordingly
            print("Direct Lambda invocation detected")
            return response_with_cors(400, {"message": "API Gateway proxy request expected."})

        method = event['httpMethod']
        resource = event.get('resource')
        path = event.get('path', '')

        # Handle case when resource is not present but path is (older API Gateway config)
        if not resource and path:
            print(f"Resource not found, using path: {path}")
            # Map path to resource pattern
            if path.startswith('/profiles'):
                resource = "/profiles"
            elif path.startswith('/services'):
                resource = "/services"
            elif '/bookings/' in path and '/session' in path:
                resource = "/bookings/{booking_id}/session"
                # Extract booking_id from path and add to pathParameters
                path_parts = path.split('/')
                booking_index = -1

                # Find the index of 'bookings' in the path
                for i, part in enumerate(path_parts):
                    if part == 'bookings':
                        booking_index = i
                        break

                if booking_index >= 0 and booking_index + 1 < len(path_parts):
                    booking_id = path_parts[booking_index + 1]
                    print(f"Extracted booking_id: {booking_id} for session lookup")

                    if 'pathParameters' not in event:
                        event['pathParameters'] = {}
                    event['pathParameters']['booking_id'] = booking_id
            elif path.startswith('/bookings'):
                resource = "/bookings"
            elif path.startswith('/availability') and len(path.split('/')) > 2:
                resource = "/availability/{id}"
            elif path.startswith('/availability'):
                resource = "/availability"
            elif path.startswith('/sessions') and len(path.split('/')) > 2:
                resource = "/sessions/{id}"
            elif path.startswith('/sessions'):
                resource = "/sessions"
            elif path.startswith('/search/teachers'):
                resource = "/search/teachers"
            elif path.startswith('/presigned-url'):
                resource = "/presigned-url"
            elif path.startswith('/meetings/') and len(path.split('/')) > 2:
                resource = "/meetings/{session_id}"
                session_id = path.split('/meetings/')[1]
                if 'pathParameters' not in event:
                    event['pathParameters'] = {}
                event['pathParameters']['session_id'] = session_id
            elif path.startswith('/meetings'):
                resource = "/meetings"
            elif path.startswith('/attendees'):
                resource = "/attendees"

        # Log the resource and method being handled
        print(f"Handling request: {resource} [{method}]")

        # CORS Preflight Handling
        if method == "OPTIONS":
            return response_with_cors(200, {"message": "CORS preflight successful"})

        # Log request details for debugging
        print(f"Headers: {json.dumps(event.get('headers', {}), default=str)}")
        print(f"Query parameters: {json.dumps(event.get('queryStringParameters', {}), default=str)}")

        # Log additional debug information for bookings/session path
        if '/bookings/' in path and '/session' in path:
            print(f"Debug - Path contains booking/session pattern")
            print(f"Debug - Resource resolved to: {resource}")
            print(f"Debug - pathParameters: {event.get('pathParameters')}")

            # Ensure we have consistent parameter naming
            if 'pathParameters' in event and event['pathParameters'] is not None:
                if 'booking-id' in event['pathParameters'] and 'booking_id' not in event['pathParameters']:
                    event['pathParameters']['booking_id'] = event['pathParameters']['booking-id']
                    print(f"Debug - Copied booking-id to booking_id: {event['pathParameters']['booking_id']}")

        try:
            # Routing based on resource and method
            print(f"[TRACE] Request routing: resource={resource}, method={method}, path={path}")
            if resource == "/profiles" and method == "GET":
                return get_user_profile(event)
            elif resource == "/profiles" and method == "POST":
                return create_user_profile(event)
            elif resource == "/services" and method == "POST":
                return create_service(event)
            elif resource == "/services" and method == "GET":
                return get_services(event)
            elif resource == "/bookings" and method == "POST":
                return create_booking(event)
            elif resource == "/bookings" and method == "GET":
                return get_bookings(event)
            elif (resource == "/bookings/{booking_id}/session" or resource == "/bookings/{booking-id}/session") and method == "GET":
                print(f"Debug - Calling get_booking_session with booking_id: {event.get('pathParameters', {}).get('booking_id')}")
                return get_booking_session(event)
            elif resource == "/availability" and method == "POST":
                print(f"[TRACE] Routing /availability POST request to create_availability")
                return create_availability(event)
            elif resource == "/availability" and method == "GET":
                print(f"[TRACE] Routing /availability GET request to get_availabilities")
                return get_availabilities(event)
            elif resource == "/availability/{id}" and method == "DELETE":
                return delete_availability(event)
            elif resource == "/sessions" and method == "POST":
                return create_session(event)
            elif resource == "/sessions/{id}" and method == "GET":
                return get_session(event)
            elif resource == "/sessions/{id}" and method == "PUT":
                return update_session(event)
            elif resource == "/search/teachers" and method == "GET":
                return search_teachers(event)
            elif resource == "/presigned-url" and method == "POST":
                return generate_presigned_url(event)
            elif resource == "/meetings" and method == "POST":
                return create_chime_meeting(event)
            elif resource == "/meetings/{session_id}" and method == "GET":
                return get_chime_meeting(event)
            elif resource == "/meetings" and method == "DELETE":
                return end_chime_meeting(event)
            elif resource == "/attendees" and method == "POST":
                return create_chime_attendee(event)
            else:
                print(f"[ERROR] Unknown route: {resource}:{method}, path: {path}")
                return response_with_cors(404, {"message": "Endpoint not found", "resource": resource, "method": method, "path": path})
        except Exception as route_error:
            print(f"[ERROR] Exception in route handling: {str(route_error)}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            return response_with_cors(500, {"message": "Error processing request", "error": str(route_error)})

    except Exception as e:
        print(f"[ERROR] Unhandled exception in lambda_handler: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return response_with_cors(500, {"message": "Internal server error", "error": str(e)})