terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  backend "s3" {
    # Configure backend via CLI or terraform.tfvars
    bucket = "christianmoore-me-tf-state"
    key    = "tf.state"
    region = "us-east-1"
    # dynamodb_table = "terraform-state-lock"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "christianmoore-me"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_name
    ]
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# EKS Cluster Module
module "eks" {
  source = "./modules/eks"

  project_name                         = var.project_name
  environment                          = var.environment
  cluster_version                      = var.eks_cluster_version
  vpc_id                               = module.vpc.vpc_id
  vpc_cidr                             = var.vpc_cidr
  private_subnet_ids                   = module.vpc.private_subnet_ids
  node_instance_types                  = var.eks_node_instance_types
  node_desired_size                    = var.eks_node_desired_size
  node_min_size                        = var.eks_node_min_size
  node_max_size                        = var.eks_node_max_size
  github_actions_role_arn              = module.github_oidc.role_arn
  cluster_endpoint_public_access_cidrs = var.eks_cluster_endpoint_public_access_cidrs

  depends_on = [module.github_oidc]
}

# ECR Repository Module
module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

# Application Load Balancer Module
module "alb" {
  source = "./modules/alb"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = module.acm.certificate_arn

  depends_on = [module.acm, module.eks]
}

# GitHub Actions OIDC Module
module "github_oidc" {
  source = "./modules/github-oidc"

  role_name   = "${var.project_name}-github-actions"
  github_org  = var.github_org
  github_repo = var.github_repo
}

# ACM Certificate Module
module "acm" {
  source = "./modules/acm"

  project_name = var.project_name
  environment  = var.environment
  domain_name  = var.backend_domain_name

  # Don't auto-validate - requires manual DNS setup
  validate_certificate = false
}
