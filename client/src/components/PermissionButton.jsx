import { can } from "../auth";
export default function PermissionButton({ module, action = "view", disabled, title, ...props }) {
  const allowed = can(module, action);
  return <button {...props} disabled={disabled || !allowed} title={allowed ? title : "You do not have permission to perform this action."} />;
}
