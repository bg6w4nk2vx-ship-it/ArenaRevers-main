param(
    [ValidateSet("syntax", "tasks", "inventory", "deploy")]
    [string]$Action = "syntax",
    [ValidateSet("dev", "prod")]
    [string]$Env = "dev"
)

$ErrorActionPreference = "Stop"

$inventory = if ($Env -eq "prod") { "inventories/prod/hosts.yml" } else { "inventories/dev/hosts.yml" }

$baseArgs = @(
    "run", "--rm",
    "-v", "${PWD}:/work",
    "-w", "/work/ansible",
    "-e", "ANSIBLE_CONFIG=/work/ansible/ansible.cfg",
    "cytopia/ansible:latest"
)

switch ($Action) {
    "syntax" {
        $cmdArgs = $baseArgs + @("ansible-playbook", "-i", $inventory, "playbooks/deploy.yml", "--syntax-check")
    }
    "tasks" {
        $cmdArgs = $baseArgs + @("ansible-playbook", "-i", $inventory, "playbooks/deploy.yml", "--list-tasks")
    }
    "inventory" {
        $cmdArgs = $baseArgs + @("ansible-inventory", "-i", $inventory, "--graph")
    }
    "deploy" {
        $cmdArgs = $baseArgs + @("ansible-playbook", "-i", $inventory, "playbooks/deploy.yml")
    }
}

& docker @cmdArgs
