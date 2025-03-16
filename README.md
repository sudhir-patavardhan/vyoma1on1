# Vyoma Learning Platform

A platform connecting students with Sanskrit teachers for personalized virtual learning sessions.

## Project Structure

- `connectplatform/` - Backend Lambda API (Python)
- `session-app/` - Frontend React application

## Deployment Instructions

### Setting up Separate Deployment Pipelines

This project supports independent deployment of frontend and backend components.

#### Backend Deployment (API)

1. Create a new CodeBuild project in the AWS Console
2. Configure source:
   - Connect to your repository
   - Set branch to `main`
3. Environment settings:
   - Use a managed image with Amazon Linux 2
   - Runtime: Standard
   - Image: aws/codebuild/amazonlinux2-x86_64-standard:3.0
4. Buildspec settings:
   - Use a buildspec file
   - Buildspec name: `connectplatform/buildspec-backend.yml`
5. Set up necessary IAM permissions for CodeBuild role (see IAM section below)
6. Create the project

#### Frontend Deployment (React App)

1. Create a new CodeBuild project in the AWS Console
2. Configure source:
   - Connect to your repository
   - Set branch to `main`
3. Environment settings:
   - Use a managed image with Amazon Linux 2
   - Runtime: Standard
   - Image: aws/codebuild/amazonlinux2-x86_64-standard:3.0
4. Buildspec settings:
   - Use a buildspec file
   - Buildspec name: `session-app/buildspec-frontend.yml`
5. Set up necessary IAM permissions for CodeBuild role
6. Create the project

### IAM Permissions Required

The CodeBuild service role for each project needs specific permissions:

#### Backend Deployment Role:
- CloudFormation (CreateStack, DescribeStacks, etc.)
- Lambda (CreateFunction, UpdateFunction, etc.)
- IAM (CreateRole, PassRole, etc.)
- DynamoDB (CreateTable, DescribeTable, etc.)
- S3 (PutObject, GetObject, etc.)
- API Gateway (CreateApi, CreateDeployment, etc.)

#### Frontend Deployment Role:
- S3 (PutObject, GetObject, ListBucket, etc.)
- CloudFront (CreateInvalidation)

## Manual Deployments

You can also trigger deployments manually:

### Backend:
```bash
cd connectplatform
./create-deployment.sh
aws cloudformation deploy --template-file deployment-template.yml --stack-name yoursanskritteacher-api --parameter-overrides Stage=prod Region=us-east-1 --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND --no-fail-on-empty-changeset --region us-east-1
```

### Frontend:
```bash
cd session-app
npm install
npm run build
aws s3 sync build/ s3://yoursanskritteacher-react-app-deployments/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_CLOUDFRONT_DISTRIBUTION_ID --paths "/*"
```

## Environment Configuration

The application supports multiple environments through the `STAGE` parameter:

- prod - Production environment
- dev - Development environment 
- test - Testing environment

Database tables are created with the stage name as a suffix to avoid conflicts.