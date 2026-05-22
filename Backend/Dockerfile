# Stage 1: build & publish
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY src/SimonMovilidad.IoT.Core/*.csproj ./src/SimonMovilidad.IoT.Core/
COPY src/SimonMovilidad.IoT.Infrastructure/*.csproj ./src/SimonMovilidad.IoT.Infrastructure/
COPY src/SimonMovilidad.IoT.API/*.csproj ./src/SimonMovilidad.IoT.API/
RUN dotnet restore ./src/SimonMovilidad.IoT.API/SimonMovilidad.IoT.API.csproj

COPY . .
RUN dotnet publish ./src/SimonMovilidad.IoT.API/SimonMovilidad.IoT.API.csproj \
    -c Release -o /app/publish --no-restore && \
    cp -r /src/src/SimonMovilidad.IoT.Infrastructure/Simulation/Data /app/publish/Data

# Stage 2: runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DB_PATH=/app/data/fleet.db

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data

COPY --from=build /app/publish .
EXPOSE 8080

ENTRYPOINT ["dotnet", "SimonMovilidad.IoT.API.dll"]
