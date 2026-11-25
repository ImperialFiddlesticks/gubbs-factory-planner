using System;

public class PlacementService
{
    public (bool CanPlace, string? Code) Check(
        int hallWidthMm,
        int hallDepthMm,
        int machineWidthMm,
        int machineDepthMm,
        int xMm,
        int yMm,
        int rotationDegrees)
    {
        if (hallWidthMm <= 0 || hallDepthMm <= 0 ||
            machineWidthMm <= 0 || machineDepthMm <= 0 ||
            rotationDegrees is not (0 or 90 or 180 or 270))
        {
            return (false, "INVALID_INPUT");
        }

        if (rotationDegrees is 90 or 270)
        {
            (machineWidthMm, machineDepthMm) = (machineDepthMm, machineWidthMm);
        }

        double halfWidth = machineWidthMm / 2.0;
        double halfDepth = machineDepthMm / 2.0;

        bool fits =
            xMm - halfWidth >= 0 &&
            xMm + halfWidth <= hallWidthMm &&
            yMm - halfDepth >= 0 &&
            yMm + halfDepth <= hallDepthMm;

        return fits ? (true, null) : (false, "OUTSIDE_HALL");
    }
}
