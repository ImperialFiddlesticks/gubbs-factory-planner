using System;
using System.Collections.Generic;

internal sealed record UtilityDemandResult(
    double TotalRequiredPowerKw,
    int WaterRequiredMachineCount,
    int FireSuppressionRequiredMachineCount,
    IReadOnlyList<MachineInstance> UnresolvedMachinePlacements);

public sealed class UtilityDemandService
{
    internal UtilityDemandResult Analyze(
        IEnumerable<MachineInstance> machines,
        IEnumerable<MachineType> machineTypes)
    {
        ArgumentNullException.ThrowIfNull(machines);
        ArgumentNullException.ThrowIfNull(machineTypes);

        var typesById = new Dictionary<Guid, MachineType>();
        foreach (var machineType in machineTypes)
        {
            ArgumentNullException.ThrowIfNull(machineType);
            if (!typesById.TryAdd(machineType.Id, machineType))
            {
                throw new ArgumentException(
                    $"More than one machine type has ID '{machineType.Id}'.",
                    nameof(machineTypes));
            }
        }

        var totalPowerKw = 0d;
        var waterRequiredCount = 0;
        var fireSuppressionRequiredCount = 0;
        var unresolved = new List<MachineInstance>();
        foreach (var machine in machines)
        {
            ArgumentNullException.ThrowIfNull(machine);
            if (!typesById.TryGetValue(machine.MachineTypeId, out var machineType))
            {
                unresolved.Add(machine);
                continue;
            }

            totalPowerKw += machineType.PowerKw;
            if (machineType.NeedsWater)
            {
                waterRequiredCount++;
            }

            if (machineType.NeedsFireSuppression)
            {
                fireSuppressionRequiredCount++;
            }
        }

        return new UtilityDemandResult(
            totalPowerKw,
            waterRequiredCount,
            fireSuppressionRequiredCount,
            unresolved);
    }
}
