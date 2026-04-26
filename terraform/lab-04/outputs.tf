output "users" {
  value = [for user in aws_iam_user.users : user.name]
}

output "groups" {
  value = keys(aws_iam_group.groups)
}
