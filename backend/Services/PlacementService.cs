using System;

public class PlacementService
{
    public (bool CanPlace, string? Code) Check(
        int hallWidthMm,
        int hallDepthMm,
        MachineInstance machine,
        MachineType machineType)
    {
        if (hallWidthMm <= 0 || hallDepthMm <= 0 ||
            machineType.WidthMm <= 0 || machineType.DepthMm <= 0 ||
            !double.IsFinite(machine.RotationDegrees))
        {
            return (false, "INVALID_INPUT");
        }

        double radians = machine.RotationDegrees * Math.PI / 180.0;
        double halfWidth = machineType.WidthMm / 2.0;
        double halfDepth = machineType.DepthMm / 2.0;

        double rotatedHalfWidth =
            Math.Abs(Math.Cos(radians)) * halfWidth +
            Math.Abs(Math.Sin(radians)) * halfDepth;

        double rotatedHalfDepth =
            Math.Abs(Math.Sin(radians)) * halfWidth +
            Math.Abs(Math.Cos(radians)) * halfDepth;

        bool fits =
            machine.Xmm - rotatedHalfWidth >= 0 &&
            machine.Xmm + rotatedHalfWidth <= hallWidthMm &&
            machine.Ymm - rotatedHalfDepth >= 0 &&
            machine.Ymm + rotatedHalfDepth <= hallDepthMm;

        return fits ? (true, null) : (false, "OUTSIDE_HALL");
    }
}