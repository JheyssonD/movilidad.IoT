using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SimonMovilidad.IoT.API.Middleware;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Xunit;

namespace SimonMovilidad.IoT.Tests
{
    public class JwtMiddlewareTests
    {
        [Fact]
        public async Task Invoke_WithNoToken_ShouldNotAttachUserToContext()
        {
            // Arrange
            var context = new DefaultHttpContext();

            var inMemorySettings = new Dictionary<string, string?> {
                {"JWT_SECRET", "SuperSecretSimonMovilidadKey2026SecureStringWithMoreBytes"}
            };

            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            var middleware = new JwtMiddleware(
                next: (innerHttpContext) => Task.CompletedTask,
                configuration: configuration,
                logger: NullLogger<JwtMiddleware>.Instance
            );

            // Act
            await middleware.Invoke(context);

            // Assert
            Assert.Null(context.Items["UserEmail"]);
            Assert.Null(context.Items["UserRole"]);
        }

        [Fact]
        public async Task Invoke_WithInvalidTokenFormat_ShouldNotAttachUserToContext()
        {
            // Arrange
            var context = new DefaultHttpContext();
            context.Request.Headers["Authorization"] = "Bearer invalidtoken";

            var inMemorySettings = new Dictionary<string, string?> {
                {"JWT_SECRET", "SuperSecretSimonMovilidadKey2026SecureStringWithMoreBytes"}
            };

            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            var middleware = new JwtMiddleware(
                next: (innerHttpContext) => Task.CompletedTask,
                configuration: configuration,
                logger: NullLogger<JwtMiddleware>.Instance
            );

            // Act
            await middleware.Invoke(context);

            // Assert
            Assert.Null(context.Items["UserEmail"]);
            Assert.Null(context.Items["UserRole"]);
        }

        [Fact]
        public async Task Invoke_WithValidToken_ShouldAttachClaimsPrincipalToContext()
        {
            // Arrange
            var secret = "SuperSecretSimonMovilidadKey2026SecureStringWithMoreBytes";
            var inMemorySettings = new Dictionary<string, string?> {
                {"JWT_SECRET", secret}
            };
            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            // Generate standard JWT token matching requirements
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(secret);
            var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[] 
                { 
                    new Claim("email", "admin@simon.com"),
                    new Claim("role", "Admin")
                }),
                Expires = DateTime.UtcNow.AddMinutes(30),
                Issuer = "SimonMovilidad",
                Audience = "SimonMovilidadUsers",
                SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                    new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key), 
                    Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature)
            };
            var securityToken = tokenHandler.CreateToken(tokenDescriptor);
            var validToken = tokenHandler.WriteToken(securityToken);

            var context = new DefaultHttpContext();
            context.Request.Headers["Authorization"] = $"Bearer {validToken}";

            var middleware = new JwtMiddleware(
                next: (innerHttpContext) => Task.CompletedTask,
                configuration: configuration,
                logger: NullLogger<JwtMiddleware>.Instance
            );

            // Act
            await middleware.Invoke(context);

            // Assert
            Assert.NotNull(context.User);
            Assert.True(context.User.Identity?.IsAuthenticated);
            Assert.Equal("admin@simon.com", context.User.FindFirst(ClaimTypes.Email)?.Value);
            Assert.Equal("Admin", context.User.FindFirst(ClaimTypes.Role)?.Value);
            Assert.True(context.User.IsInRole("Admin"));
        }
    }
}
