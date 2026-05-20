using Microsoft.EntityFrameworkCore;
using SimonMovilidad.IoT.Core.Models;

namespace SimonMovilidad.IoT.Infrastructure.Persistence
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<Telemetry> Telemetries => Set<Telemetry>();
        public DbSet<User> Users => Set<User>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            // Seed default users for validation
            modelBuilder.Entity<User>().HasData(
                new User { Id = 1, Email = "admin@simon.com", PasswordHash = "Admin123!", Role = "Admin" },
                new User { Id = 2, Email = "user@simon.com", PasswordHash = "User123!", Role = "User" }
            );
        }
    }
}
