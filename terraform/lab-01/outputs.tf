output "container_name" {
  value = docker_container.nginx.name
}

output "container_port" {
  value = docker_container.nginx.ports[0].external
}
