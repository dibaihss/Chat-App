# Terraform Foundation (Dev-first)

This directory provisions Azure foundation resources for the chat app project.

## Managed resources (phase 1)

- Resource Group
- Virtual Network and future-use subnets
- Key Vault (private network access disabled by default)
- Storage Account (TLS1.2+, no public blob access)
- Log Analytics + Application Insights

## Not managed yet (placeholders only)

- App runtime (App Service / Container Apps)
- Data services (SQL/Cosmos)
- Private endpoints + Private DNS
- Application Gateway / WAF

## Variable contract

Core variables live in `variables.tf` and are provided via `dev.tfvars` for the first environment.

Expected environment model going forward:

- `dev.tfvars`
- `staging.tfvars` (future)
- `prod.tfvars` (future)

## Remote state bootstrap (manual prerequisite)

This stack expects an existing Azure Storage backend for Terraform state.

1. Create state resource group (example: `rg-tf-state`).
2. Create globally unique storage account (example: `sttstatexxxx`).
3. Create blob container (example: `tfstate`).
4. Grant your deployment identity read/write to that storage account.

You can keep backend coordinates in GitHub repository variables and pass them during `terraform init`.

## Local usage

```bash
cd infra
terraform fmt -check
terraform init \
  -backend-config="resource_group_name=<rg-tf-state>" \
  -backend-config="storage_account_name=<sttstatexxxx>" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=chat-app-dev.tfstate"
terraform validate
terraform plan -var-file=dev.tfvars
```
