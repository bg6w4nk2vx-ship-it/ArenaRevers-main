# Terraform Labs for ArenaReserve

This folder contains a study scaffold for the Terraform tasks listed in the assignment.

## Included labs

- LAB-00: Terraform installation and AWS configuration
- LAB-01: Docker provider, image pull, and local container creation
- LAB-02: EC2 base instance on Ubuntu 22.04
- LAB-03: Variables, locals, and outputs for EC2
- LAB-04: Count, for_each, and map for IAM users, groups, policies, and attachments
- LAB-05: Dynamic blocks for security groups, EC2, and VPC

## How to use

Each lab is a separate Terraform root module. Open the lab directory you need and run:

terraform init
terraform fmt
terraform validate
terraform plan

## Notes

- LAB-00 and all AWS labs require AWS credentials configured in your environment.
- LAB-01 requires Docker running on the local machine.
- The examples use placeholders and safe defaults; replace values before applying them to a real account.

## Windows policy note (LAB-01)

On some Windows environments, Application Control can block Terraform provider binaries.
If LAB-01 fails with a provider `.exe` blocked message, use this for runtime demo:

docker run -d --name terraform-nginx-lab -p 8085:80 nginx:latest

Then open `http://localhost:8085` and show container status with:

docker ps --filter "name=terraform-nginx-lab"
