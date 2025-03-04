import json
import boto3
import uuid
import os
from datetime import datetime
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError
from decimal import Decimal

# Initialize DynamoDB resources and table names
dynamodb = boto3.resource('dynamodb')
dynamodb_client = boto3.client('dynamodb')

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
    return {
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

def create_table_if_not_exists(table_name, key_schema, attribute_definitions):
    """Creates a DynamoDB table if it doesn't already exist."""
    try:
        dynamodb_client.describe_table(TableName=table_name)
        print(f"Table {table_name} already exists.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            try:
                print(f"Creating table: {table_name}")
                table = dynamodb.create_table(
                    TableName=table_name,
                    KeySchema=key_schema,
                    AttributeDefinitions=attribute_definitions,
                    BillingMode='PAY_PER_REQUEST'
                )
                table.wait_until_exists()
                print(f"Table {table_name} created successfully.")
            except Exception as create_error:
                print(f"Error creating table {table_name}: {str(create_error)}")
                # Don't re-raise to allow other tables to be created
        else:
            print(f"Error checking table {table_name}: {str(e)}")

def ensure_tables_exist():
    """Ensures all required DynamoDB tables exist."""
    create_table_if_not_exists(
        SERVICE_TABLE,
        [{'AttributeName': 'service_id', 'KeyType': 'HASH'}],
        [{'AttributeName': 'service_id', 'AttributeType': 'S'}]
    )
    create_table_if_not_exists(
        BOOKINGS_TABLE,
        [{'AttributeName': 'booking_id', 'KeyType': 'HASH'}],
        [{'AttributeName': 'booking_id', 'AttributeType': 'S'}]
    )
    create_table_if_not_exists(
        PROFILE_TABLE,
        [{'AttributeName': 'user_id', 'KeyType': 'HASH'}],
        [{'AttributeName': 'user_id', 'AttributeType': 'S'}]
    )
    create_table_if_not_exists(
        AVAILABILITY_TABLE,
        [{'AttributeName': 'availability_id', 'KeyType': 'HASH'}],
        [
            {'AttributeName': 'availability_id', 'AttributeType': 'S'}
        ]
    )
    create_table_if_not_exists(
        SESSION_TABLE,
        [{'AttributeName': 'session_id', 'KeyType': 'HASH'}],
        [{'AttributeName': 'session_id', 'AttributeType': 'S'}]
    )

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
            # Try with the new table name format first
            table = dynamodb.Table(PROFILE_TABLE)
            response = table.get_item(Key={'user_id': user_id})
            
            # If no item found and we're using the new table naming convention, try the old table
            if 'Item' not in response and '-' in PROFILE_TABLE:
                old_table_name = 'UserProfiles'  # Try the original table name
                print(f"Item not found in {PROFILE_TABLE}, trying {old_table_name}")
                old_table = dynamodb.Table(old_table_name)
                response = old_table.get_item(Key={'user_id': user_id})
        except Exception as table_error:
            print(f"Error accessing table {PROFILE_TABLE}: {str(table_error)}")
            # If new table doesn't exist, fall back to old table
            old_table_name = 'UserProfiles'
            print(f"Trying fallback table: {old_table_name}")
            old_table = dynamodb.Table(old_table_name)
            response = old_table.get_item(Key={'user_id': user_id})

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
        body = json.loads(event['body'])
        user_id = body.get('user_id')
        profile_data = body.get('profile_data', {})

        if not user_id:
            return response_with_cors(400, {"message": "user_id is required to create or update profile."})

        timestamp = datetime.utcnow().isoformat()
        profile_item = {
            'user_id': user_id,
            'created_at': timestamp,
            'updated_at': timestamp,
            **profile_data
        }

        table = dynamodb.Table(PROFILE_TABLE)
        existing_profile = table.get_item(Key={'user_id': user_id}).get('Item')

        # If profile exists, retain the original creation timestamp
        if existing_profile:
            profile_item['created_at'] = existing_profile['created_at']

        table.put_item(Item=profile_item)
        return response_with_cors(201, {"message": "User profile created/updated successfully.", "profile": profile_item})
    except (ClientError, json.JSONDecodeError) as e:
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
        body = json.loads(event['body'])

        # Validate required fields
        required_fields = ['teacher_id', 'start_time', 'end_time', 'topic']
        for field in required_fields:
            if field not in body:
                return response_with_cors(400, {"message": f"Missing required field: {field}"})

        # Generate a unique availability ID
        availability_id = f"avail-{uuid.uuid4()}"
        timestamp = datetime.utcnow().isoformat()

        # Create the availability record
        new_availability = {
            'availability_id': availability_id,
            'teacher_id': body['teacher_id'],
            'start_time': body['start_time'],
            'end_time': body['end_time'],
            'topic': body['topic'],
            'description': body.get('description', ''),
            'status': 'available',
            'created_at': timestamp,
        }

        # Add any additional availability data
        for key, value in body.items():
            if key not in new_availability:
                new_availability[key] = value

        # Store in DynamoDB
        availability_table = dynamodb.Table(AVAILABILITY_TABLE)
        availability_table.put_item(Item=new_availability)

        return response_with_cors(201, {
            "message": "Availability slot created successfully",
            "availability_id": availability_id,
            "availability": new_availability
        })
    except (ClientError, json.JSONDecodeError) as e:
        return response_with_cors(500, {"message": "Error creating availability slot.", "error": str(e)})

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
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': key,
                'ContentType': file_type,
                'ACL': 'public-read'
            },
            ExpiresIn=300  # URL expires in 5 minutes
        )

        # Construct the public URL that will be accessible after upload
        public_url = f"https://{bucket_name}.s3.amazonaws.com/{key}"

        return response_with_cors(200, {
            'upload_url': presigned_url,
            'public_url': public_url
        })
    except Exception as e:
        print(f"Error generating presigned URL: {str(e)}")
        return response_with_cors(500, {"message": "Error generating upload URL", "error": str(e)})

# ========== Search ==========
def search_teachers(event):
    """Searches for teachers based on topic/subject."""
    try:
        query_params = event.get('queryStringParameters', {})
        topic = query_params.get('topic', '').lower()

        if not topic:
            return response_with_cors(400, {"message": "Missing search topic"})

        # Search for teachers who offer this topic
        profile_table = dynamodb.Table(PROFILE_TABLE)
        response = profile_table.scan(
            FilterExpression=Attr('role').eq('teacher')
        )

        teachers = []
        for teacher in response['Items']:
            # Check if any of the teacher's topics match the search
            if 'topics' in teacher:
                teacher_topics = [t.lower() for t in teacher['topics']]
                if any(topic in t for t in teacher_topics):
                    teachers.append(teacher)

        return response_with_cors(200, convert_decimal(teachers))
    except ClientError as e:
        return response_with_cors(500, {"message": "Error searching for teachers.", "error": str(e)})

# ========== Lambda Handler ==========
def lambda_handler(event, context):
    """Main Lambda entry point to handle incoming requests."""
    print(f"Received event: {event}")
    
    try:
        # Ensure tables exist before processing any request
        ensure_tables_exist()
        
        # Handle direct invocations or API Gateway proxied requests
        if 'httpMethod' not in event:
            # This is likely a direct Lambda invocation, handle accordingly
            print("Direct Lambda invocation detected")
            return response_with_cors(400, {"message": "API Gateway proxy request expected."})
    
        method = event['httpMethod']
        resource = event.get('resource')
        
        # Handle case when resource is not present but path is (older API Gateway config)
        if not resource and 'path' in event:
            path = event['path']
            print(f"Resource not found, using path: {path}")
            # Map path to resource pattern
            if path.startswith('/profiles'):
                resource = "/profiles"
            elif path.startswith('/services'):
                resource = "/services"
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
        
        # Log the resource and method being handled
        print(f"Handling request: {resource} [{method}]")

        # CORS Preflight Handling
        if method == "OPTIONS":
            return response_with_cors(200, {"message": "CORS preflight successful"})

        # Routing based on resource and method
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
        elif resource == "/availability" and method == "POST":
            return create_availability(event)
        elif resource == "/availability" and method == "GET":
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
        else:
            print(resource + ':' + method)
            return response_with_cors(405, {"message": "Method Not Allowed"})
    
    except Exception as e:
        print(f"Unhandled exception in lambda_handler: {str(e)}")
        return response_with_cors(500, {"message": "Internal server error", "error": str(e)})