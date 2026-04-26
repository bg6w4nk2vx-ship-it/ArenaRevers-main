provider "aws" {
  region = var.aws_region
}

locals {
  users = ["admin", "devops", "analyst"]

  groups = {
    administrators = ["admin"]
    operators      = ["devops", "analyst"]
  }

  user_groups = {
    admin   = ["administrators"]
    devops  = ["operators"]
    analyst = ["operators"]
  }
}

resource "aws_iam_user" "users" {
  count = length(local.users)

  name = local.users[count.index]
  path = "/"
}

resource "aws_iam_group" "groups" {
  for_each = local.groups

  name = each.key
}

resource "aws_iam_user_group_membership" "membership" {
  for_each = local.user_groups

  user   = aws_iam_user.users[index(local.users, each.key)].name
  groups = each.value

  depends_on = [
    aws_iam_group.groups
  ]
}

resource "aws_iam_policy" "readonly" {
  name        = "arenareserve-readonly"
  description = "Read only access policy for the lab"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ec2:Describe*", "s3:ListAllMyBuckets"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_group_policy_attachment" "readonly" {
  for_each = aws_iam_group.groups

  group      = each.value.name
  policy_arn = aws_iam_policy.readonly.arn
}
