# Jenkins: Terraform + Ansible Demo

This file describes how to run Terraform/Ansible labs through Jenkins in a single pipeline job.

## 1) Create Pipeline Job

1. In Jenkins click **New Item**.
2. Name it: `Arena Infra CD (Terraform + Ansible)`.
3. Select **Pipeline**.
4. In **Pipeline script from SCM** choose your repository.
5. Set **Script Path** to: `ci/Jenkinsfile.terraform-ansible`.

## 2) Agent Requirements

- Terraform CLI available in PATH.
- Docker available and running.
- AWS credentials configured for Jenkins agent user (or injected by your Jenkins credentials workflow).

## 2.1) AWS Credentials for Jenkins

For Terraform AWS labs, Jenkins must provide AWS credentials.
You can use Jenkins credentials of type **Secret text** for:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` (optional)

Then set the corresponding pipeline parameters:

- `AWS_ACCESS_KEY_ID_CRED`
- `AWS_SECRET_ACCESS_KEY_CRED`
- `AWS_SESSION_TOKEN_CRED`

If credentials are not provided, Terraform will still run, but AWS provider actions will fail unless the agent already has valid AWS access.

## 3) Run Parameters

- `TERRAFORM_LAB`: lab folder (`lab-00` ... `lab-05`).
- `TF_ACTION`: `plan`, `apply`, or `destroy`.
- `RUN_ANSIBLE`: run Ansible stage after Terraform.
- `ANSIBLE_ACTION`: `syntax`, `tasks`, `inventory`, or `deploy`.

## 4) Recommended Demo Build

1. Run with:
   - `TERRAFORM_LAB=lab-05`
   - `TF_ACTION=apply`
   - `RUN_ANSIBLE=true`
   - `ANSIBLE_ACTION=syntax`
2. Show successful Jenkins stages.
3. Show AWS resources (EC2, VPC, Security Group) and IAM users from lab-04.

## 5) Cleanup Build

Run another build with:

- `TERRAFORM_LAB=lab-05`
- `TF_ACTION=destroy`
- `RUN_ANSIBLE=false`
