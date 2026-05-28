(function () {
  var hash = window.location.hash || "";
  if (!hash || hash.indexOf("access_token=") === -1) return;

  var raw = hash.charAt(0) === "#" ? hash.slice(1) : hash;
  var params = new URLSearchParams(raw);
  var token = params.get("access_token");
  if (!token) return;

  try {
    window.localStorage.setItem("access_token", token);
    window.localStorage.setItem("auth_source", "local");
    window.localStorage.removeItem("auth_user");
  } catch (_) {
    return;
  }

  params.delete("access_token");
  var newHash = params.toString();
  var nextUrl = window.location.pathname + window.location.search + (newHash ? "#" + newHash : "");
  window.history.replaceState(null, "", nextUrl);
})();
