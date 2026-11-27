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
            "http://localhost:5174");
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

builder.Services.AddSingleton<backend.Services.IProjectRepository>(_ =>
    new backend.Services.FileProjectRepository(
        builder.Configuration["ProjectStore:Directory"] ??
        Path.Combine(builder.Environment.ContentRootPath, "App_Data", "projects")));


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
