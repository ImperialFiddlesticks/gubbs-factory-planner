using System;

public class MachineInstance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MachineTypeId { get; set; }
	public int Xmm { get; set; }
	public int Ymm { get; set; }
	public double RotationDegrees { get; set; }
	public double? Length { get; set; }
}
