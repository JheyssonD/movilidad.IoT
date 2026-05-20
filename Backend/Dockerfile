FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-env
WORKDIR /app

# Copy csproj and restore as distinct layers
COPY src/SimonMovilidad.IoT.Core/*.csproj ./src/SimonMovilidad.IoT.Core/
COPY src/SimonMovilidad.IoT.Infrastructure/*.csproj ./src/SimonMovilidad.IoT.Infrastructure/
COPY src/SimonMovilidad.IoT.API/*.csproj ./src/SimonMovilidad.IoT.API/
RUN dotnet restore ./src/SimonMovilidad.IoT.API/SimonMovilidad.IoT.API.csproj

# Copy everything else and build
COPY . ./
RUN dotnet publish ./src/SimonMovilidad.IoT.API/SimonMovilidad.IoT.API.csproj -c Release -o out

# Build runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build-env /app/out .
EXPOSE 8080
ENTRYPOINT ["dotnet", "SimonMovilidad.IoT.API.dll"]
