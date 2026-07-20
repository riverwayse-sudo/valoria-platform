path = "src/PRIMEAssessment.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '''async function signUpWithSupabase(email, password, name, role) {
  const identity_hash = computeFingerprint(name, role);
  const res = await fetch("/api/create-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, role, identity_hash }),
  });
  return data;
}'''

new = '''async function signUpWithSupabase(email, password, name, role) {
  const identity_hash = computeFingerprint(name, role);
  const res = await fetch("/api/create-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, role, identity_hash }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed.");
  if (data.warning) {
    console.warn(data.warning);
  }
  return data;
}'''

if old not in content:
    raise SystemExit("Could not find the exact broken block — file may have changed. Stopping without editing.")

content = content.replace(old, new, 1)
with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed signUpWithSupabase in", path)