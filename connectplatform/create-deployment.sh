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

# Upload deployment package to S3
echo "Uploading deployment package to S3..."
aws s3 cp lambda-deployment.zip s3://sessions-red-lambda-deployments/

# Set public read on the bucket for API Gateway to access it
echo "Setting bucket policy..."
aws s3api put-bucket-policy --bucket sessions-red-lambda-deployments --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sessions-red-lambda-deployments/*"
    }
  ]
}'

# Clean up
rm -rf deployment
echo "Deployment package uploaded and cleanup complete"