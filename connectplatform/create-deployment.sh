#!/bin/bash

# Create deployment package for AWS Lambda
echo "Creating Lambda deployment package..."

# Create a temporary directory
mkdir -p deployment

# Install dependencies
pip install -r requirements.txt -t deployment/

# Copy application code
cp app.py deployment/

# Create zip file
cd deployment
zip -r ../lambda-deployment.zip .
cd ..

echo "Lambda deployment package created: lambda-deployment.zip"

# Create the S3 bucket if it doesn't exist
aws s3api head-bucket --bucket sessions-red-lambda-deployments 2>/dev/null
BUCKET_EXISTS=$?

if [ $BUCKET_EXISTS -eq 0 ]; then
  echo "S3 bucket already exists"
else
  echo "Creating S3 bucket..."
  aws s3api create-bucket --bucket sessions-red-lambda-deployments --region us-east-1
fi

# Add metadata to CloudFormation template to force Lambda update
echo "Adding CodeVersion metadata to Lambda function..."
FUNCTION_VERSION=$(date +%s)
echo "Function version: $FUNCTION_VERSION"

# Upload deployment package to S3 with timestamp
# Include build timestamp in version number for unique S3 key
TIMESTAMP=$(date +%Y%m%d%H%M%S)
# Add a random component to ensure unique S3 keys even for rapid deployments
RANDOM_SUFFIX=$(head /dev/urandom | tr -dc 'a-z0-9' | head -c 6)
S3_KEY="lambda-deployment-${TIMESTAMP}-${RANDOM_SUFFIX}.zip"
echo "Uploading deployment package to S3 with key: ${S3_KEY}..."
aws s3 cp lambda-deployment.zip "s3://sessions-red-lambda-deployments/${S3_KEY}"

# Update template to use the new S3 key and force Lambda update
echo "Updating deployment template with new S3 key and adding version identifier..."
TIMESTAMP_VERSION=$(date +%Y%m%d%H%M%S)

# Use sed differently depending on OS (macOS or Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS requires an empty string after -i for in-place editing
  sed -i '' "s|S3Key: lambda-deployment.zip|S3Key: ${S3_KEY}|g" deployment-template.yml
  # Add/update a version identifier to Lambda resource to force update
  if grep -q "Description:" deployment-template.yml; then
    # Update existing description
    sed -i '' "s|Description:.*|Description: 'Sessions Red API - Connecting students with teachers - v${TIMESTAMP_VERSION}'|g" deployment-template.yml
  else
    # Add description after AWSTemplateFormatVersion
    sed -i '' "s|AWSTemplateFormatVersion:.*|AWSTemplateFormatVersion: '2010-09-09'\nDescription: 'Sessions Red API - Connecting students with teachers - v${TIMESTAMP_VERSION}'|g" deployment-template.yml
  fi
  
  # Also update the deployment timestamp and version in environment variables to force Lambda update
  sed -i '' "s|DEPLOY_TIMESTAMP: !Ref AWS::StackName|DEPLOY_TIMESTAMP: '${TIMESTAMP_VERSION}'|g" deployment-template.yml
  sed -i '' "s|BUILD_VERSION: 'will-be-replaced-during-deployment'|BUILD_VERSION: '${TIMESTAMP_VERSION}'|g" deployment-template.yml
else
  # Linux version
  sed -i "s|S3Key: lambda-deployment.zip|S3Key: ${S3_KEY}|g" deployment-template.yml
  # Add/update a version identifier to Lambda resource to force update
  if grep -q "Description:" deployment-template.yml; then
    # Update existing description
    sed -i "s|Description:.*|Description: 'Sessions Red API - Connecting students with teachers - v${TIMESTAMP_VERSION}'|g" deployment-template.yml
  else
    # Add description after AWSTemplateFormatVersion
    sed -i "s|AWSTemplateFormatVersion:.*|AWSTemplateFormatVersion: '2010-09-09'\nDescription: 'Sessions Red API - Connecting students with teachers - v${TIMESTAMP_VERSION}'|g" deployment-template.yml
  fi
  
  # Also update the deployment timestamp and version in environment variables to force Lambda update
  sed -i "s|DEPLOY_TIMESTAMP: !Ref AWS::StackName|DEPLOY_TIMESTAMP: '${TIMESTAMP_VERSION}'|g" deployment-template.yml
  sed -i "s|BUILD_VERSION: 'will-be-replaced-during-deployment'|BUILD_VERSION: '${TIMESTAMP_VERSION}'|g" deployment-template.yml
fi
echo "Template updated with version identifier v${TIMESTAMP_VERSION}"

# No need to set public read on the bucket - Lambda can access it with IAM role
echo "Skipping bucket policy - Lambda has IAM access to S3"
# The following policy is removed because it conflicts with S3 Block Public Access settings
# aws s3api put-bucket-policy --bucket sessions-red-lambda-deployments --policy '{
#   "Version": "2012-10-17",
#   "Statement": [
#     {
#       "Effect": "Allow", 
#       "Principal": "*",
#       "Action": "s3:GetObject",
#       "Resource": "arn:aws:s3:::sessions-red-lambda-deployments/*"
#     }
#   ]
# }'

# Clean up
rm -rf deployment
echo "Deployment package uploaded and cleanup complete"