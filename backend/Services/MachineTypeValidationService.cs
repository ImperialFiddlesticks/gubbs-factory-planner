using System;
using System.Collections.Generic;

public sealed record MachineTypeValidationIssue(string Field, string Message);

public sealed class MachineTypeValidationService
{
    public IReadOnlyList<MachineTypeValidationIssue> Validate(MachineType? machineType)
    {
        var issues = new List<MachineTypeValidationIssue>();
        if (machineType is null)
        {
            issues.Add(new MachineTypeValidationIssue("MachineType", "Machine type is required."));
            return issues;
        }

        if (string.IsNullOrWhiteSpace(machineType.Name))
        {
            issues.Add(new MachineTypeValidationIssue("Name", "Name must not be empty or whitespace."));
        }

        if (machineType.WidthMm <= 0)
        {
            issues.Add(new MachineTypeValidationIssue("WidthMm", "Width must be greater than zero."));
        }

        if (machineType.DepthMm <= 0)
        {
            issues.Add(new MachineTypeValidationIssue("DepthMm", "Depth must be greater than zero."));
        }

        if (!double.IsFinite(machineType.PowerKw) || machineType.PowerKw < 0)
        {
            issues.Add(new MachineTypeValidationIssue("PowerKw", "Power must be finite and nonnegative."));
        }

        if (machineType.Clearance is null)
        {
            issues.Add(new MachineTypeValidationIssue("Clearance", "Clearance values are required."));
        }
        else
        {
            AddClearanceIssue(issues, "Clearance.FrontMm", machineType.Clearance.FrontMm);
            AddClearanceIssue(issues, "Clearance.BackMm", machineType.Clearance.BackMm);
            AddClearanceIssue(issues, "Clearance.LeftMm", machineType.Clearance.LeftMm);
            AddClearanceIssue(issues, "Clearance.RightMm", machineType.Clearance.RightMm);
        }

        if (machineType.Conveyor is not (null or "straight" or "corner-left" or "corner-right"))
        {
            issues.Add(new MachineTypeValidationIssue(
                "Conveyor",
                "Conveyor must be null, 'straight', 'corner-left', or 'corner-right'."));
        }

        return issues;
    }

    private static void AddClearanceIssue(
        ICollection<MachineTypeValidationIssue> issues,
        string field,
        double value)
    {
        if (!double.IsFinite(value) || value < 0)
        {
            issues.Add(new MachineTypeValidationIssue(field, "Clearance must be finite and nonnegative."));
        }
    }
}
