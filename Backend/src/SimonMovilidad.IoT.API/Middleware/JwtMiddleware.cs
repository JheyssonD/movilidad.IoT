using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace SimonMovilidad.IoT.API.Middleware
{
    public class JwtMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IConfiguration _configuration;
        private readonly ILogger<JwtMiddleware> _logger;

        public JwtMiddleware(RequestDelegate next, IConfiguration configuration, ILogger<JwtMiddleware> logger)
        {
            _next = next;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task Invoke(HttpContext context)
        {
            var token = context.Request.Headers["Authorization"].FirstOrDefault()?.Split(" ").Last();

            if (token != null)
            {
                AttachUserToContext(context, token);
            }

            await _next(context);
        }

        private void AttachUserToContext(HttpContext context, string token)
        {
            try
            {
                // Pure manual JWT verification: Header.Payload.Signature
                var parts = token.Split('.');
                if (parts.Length != 3)
                {
                    _logger.LogWarning("Invalid JWT token format. Token does not contain 3 parts.");
                    return;
                }

                var headerBase64Url = parts[0];
                var payloadBase64Url = parts[1];
                var signatureBase64Url = parts[2];

                // 1. Decode Header and validate algorithm is explicitly HS256 (reject 'none' algorithm attacks!)
                var headerJsonBytes = Base64UrlDecode(headerBase64Url);
                var headerJson = Encoding.UTF8.GetString(headerJsonBytes);
                using (var headerDoc = JsonDocument.Parse(headerJson))
                {
                    if (!headerDoc.RootElement.TryGetProperty("alg", out var algProp) || 
                        algProp.GetString() != "HS256")
                    {
                        _logger.LogWarning("Invalid JWT algorithm. Only HS256 is accepted.");
                        return;
                    }
                }

                // 2. Validate secret configuration (no hardcoded fallback)
                var secret = _configuration["JWT_SECRET"];
                if (string.IsNullOrWhiteSpace(secret))
                {
                    throw new Exception("JWT secret is missing from configuration");
                }
                var key = Encoding.UTF8.GetBytes(secret);

                // 3. Validate signature manually via HMAC-SHA256 using constant-time comparison
                using (var hmac = new HMACSHA256(key))
                {
                    var rawBytes = Encoding.UTF8.GetBytes(headerBase64Url + "." + payloadBase64Url);
                    var computedHash = hmac.ComputeHash(rawBytes);
                    var receivedSignatureBytes = Base64UrlDecode(signatureBase64Url);

                    // Use FixedTimeEquals to protect against timing attacks
                    if (!CryptographicOperations.FixedTimeEquals(computedHash, receivedSignatureBytes))
                    {
                        _logger.LogWarning("Invalid JWT signature.");
                        return;
                    }
                }

                // 4. Decode payload manually
                var payloadJsonBytes = Base64UrlDecode(payloadBase64Url);
                var payloadJson = Encoding.UTF8.GetString(payloadJsonBytes);

                using (var doc = JsonDocument.Parse(payloadJson))
                {
                    var root = doc.RootElement;

                    // Check expiration
                    if (root.TryGetProperty("exp", out var expProp))
                    {
                        long exp = expProp.GetInt64();
                        var expTime = DateTimeOffset.FromUnixTimeSeconds(exp).UtcDateTime;
                        if (expTime < DateTime.UtcNow)
                        {
                            _logger.LogWarning("JWT token has expired.");
                            return;
                        }
                    }

                    // Check Not Before (nbf)
                    if (root.TryGetProperty("nbf", out var nbfProp))
                    {
                        long nbf = nbfProp.GetInt64();
                        var nbfTime = DateTimeOffset.FromUnixTimeSeconds(nbf).UtcDateTime;
                        if (nbfTime > DateTime.UtcNow)
                        {
                            _logger.LogWarning("JWT token is not active yet (nbf validation failed).");
                            return;
                        }
                    }

                    // Check Issuer and Audience
                    if (!root.TryGetProperty("iss", out var issProp) || issProp.GetString() != "SimonMovilidad")
                    {
                        _logger.LogWarning("Invalid JWT issuer.");
                        return;
                    }
                    if (!root.TryGetProperty("aud", out var audProp) || audProp.GetString() != "SimonMovilidadUsers")
                    {
                        _logger.LogWarning("Invalid JWT audience.");
                        return;
                    }

                    // Extract claims (email and role)
                    string email = string.Empty;
                    string role = string.Empty;

                    if (root.TryGetProperty("email", out var emailProp))
                    {
                        email = emailProp.GetString() ?? string.Empty;
                    }
                    else if (root.TryGetProperty("sub", out var subProp))
                    {
                        email = subProp.GetString() ?? string.Empty;
                    }

                    if (root.TryGetProperty("role", out var roleProp))
                    {
                        role = roleProp.GetString() ?? string.Empty;
                    }

                    if (string.IsNullOrWhiteSpace(email))
                    {
                        _logger.LogWarning("JWT missing subject/email claim.");
                        return;
                    }

                    // Attach details to HttpContext Items (compatibility fallback)
                    context.Items["UserEmail"] = email;
                    context.Items["UserRole"] = role;

                    // Build standard enterprise-grade ClaimsPrincipal
                    var claims = new[]
                    {
                        new Claim(ClaimTypes.Email, email),
                        new Claim(ClaimTypes.Name, email),
                        new Claim(ClaimTypes.Role, role)
                    };
                    var identity = new ClaimsIdentity(claims, "ManualJwtSchema");
                    var principal = new ClaimsPrincipal(identity);

                    // Attach ClaimsPrincipal to context, enabling [Authorize] and User.IsInRole() natives!
                    context.User = principal;
                }
            }
            catch (JsonException ex)
            {
                _logger.LogWarning($"JWT payload has invalid JSON: {ex.Message}");
            }
            catch (FormatException ex)
            {
                _logger.LogWarning($"JWT base64 URL decoding failed: {ex.Message}");
            }
            catch (CryptographicException ex)
            {
                _logger.LogWarning($"JWT cryptographic verification failed: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"JWT validation exception: {ex.Message}");
            }
        }

        private static string Base64UrlEncode(byte[] input)
        {
            var base64 = Convert.ToBase64String(input);
            return base64.Replace("+", "-").Replace("/", "_").Replace("=", "");
        }

        private static byte[] Base64UrlDecode(string input)
        {
            var base64 = input.Replace("-", "+").Replace("_", "/");
            switch (base64.Length % 4)
            {
                case 2: base64 += "=="; break;
                case 3: base64 += "="; break;
            }
            return Convert.FromBase64String(base64);
        }
    }
}
