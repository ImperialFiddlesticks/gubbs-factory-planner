using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MachineTypesController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok("Machinetypes not working");
    }
}