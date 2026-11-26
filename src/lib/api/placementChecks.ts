export interface PlacementCheckResponse {
    canPlace: boolean;
    code: string | null;
}

export interface MachineInstanceDto {
    xmm: number;
    ymm: number;
    rotationDegrees: number;
}
export interface MachineTypeDto {
    widthMm: number;
    depthMm: number;
    powerKw: number;
    needsWater: boolean;
    needsFireSuppression: boolean;
}

export interface PlacementCheckRequest {
    hallWidthMm: number;
    hallDepthMm: number;
    machine: MachineInstanceDto;
    machineType: MachineTypeDto;
}

export async function checkPlacement
    (request: PlacementCheckRequest):
    Promise<PlacementCheckResponse> {
    const response = await fetch(
        "http://localhost:5116/api/placement-checks",
        {
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",

            body: JSON.stringify(request)
        }
    );
    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }
    return await response.json();
    
}