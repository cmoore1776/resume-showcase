#!/bin/bash
# Script to manually create the session-provisioner ECR repository
# This is needed because Terraform changes haven't been applied yet

set -e

AWS_REGION="us-east-1"
REPO_NAME="christianmoore-me-prod-session-provisioner"

echo "Creating ECR repository: $REPO_NAME"

aws ecr create-repository \
  --repository-name "$REPO_NAME" \
  --region "$AWS_REGION" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --tags Key=Name,Value="$REPO_NAME" Key=ManagedBy,Value=Terraform \
  || echo "Repository may already exist"

echo "Setting lifecycle policy..."

aws ecr put-lifecycle-policy \
  --repository-name "$REPO_NAME" \
  --region "$AWS_REGION" \
  --lifecycle-policy-text '{
    "rules": [
      {
        "rulePriority": 1,
        "description": "Keep last 10 images",
        "selection": {
          "tagStatus": "tagged",
          "tagPrefixList": ["v"],
          "countType": "imageCountMoreThan",
          "countNumber": 10
        },
        "action": {
          "type": "expire"
        }
      },
      {
        "rulePriority": 2,
        "description": "Expire untagged images older than 7 days",
        "selection": {
          "tagStatus": "untagged",
          "countType": "sinceImagePushed",
          "countUnit": "days",
          "countNumber": 7
        },
        "action": {
          "type": "expire"
        }
      }
    ]
  }'

echo "ECR repository created successfully!"
echo "Repository URI: $(aws ecr describe-repositories --repository-names $REPO_NAME --region $AWS_REGION --query 'repositories[0].repositoryUri' --output text)"
