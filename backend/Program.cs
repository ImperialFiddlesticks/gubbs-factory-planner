var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();


builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173");
        policy.AllowAnyHeader();
        policy.AllowAnyMethod();
    } );
    
});

builder.Services.AddScoped<PlacementService>();
builder.Services.AddScoped<MachineTypeValidationService>();
builder.Services.AddScoped<UtilityDemandService>();
builder.Services.AddScoped<UtilityValidationService>();
builder.Services.AddScoped<LoadingDockValidationService>();
builder.Services.AddScoped<LoadingBayValidationService>();
builder.Services.AddScoped<TruckLogisticsValidationService>();

var projectStoreDirectory = builder.Configuration["ProjectStore:Directory"];
if (string.IsNullOrWhiteSpace(projectStoreDirectory))
{
    var documentsDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
    projectStoreDirectory = string.IsNullOrWhiteSpace(documentsDirectory)
        ? Path.Combine(builder.Environment.ContentRootPath, "App_Data", "projects")
        : Path.Combine(documentsDirectory, "Codex", "factory-planner-data");
}

builder.Services.AddSingleton<backend.Services.IProjectRepository>(_ =>
    new backend.Services.FileProjectRepository(projectStoreDirectory));


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthorization();

app.MapControllers();

app.Run();
