import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SegmentationRefPoints } from "$lib/stores/websocket/xraysockets.store";

vi.mock("$lib/core/network/csrf", () => ({
    getCSRFToken: () => "test-csrf-token"
}));

type SocketHandlers = {
    onStatus?: (status: string) => void;
    onDone?: (refPoints: SegmentationRefPoints) => void;
    onClose?: () => void;
};
const { socketHandlers, createSegmentationSocket } = vi.hoisted(() => {
    const socketHandlers: SocketHandlers = {};
    const createSegmentationSocket = vi.fn(
        (_sopInstanceUID: string, onStatus: SocketHandlers["onStatus"], onDone: SocketHandlers["onDone"], onClose: SocketHandlers["onClose"]) => {
            socketHandlers.onStatus = onStatus;
            socketHandlers.onDone = onDone;
            socketHandlers.onClose = onClose;
            return { close: vi.fn() };
        }
    );
    return { socketHandlers, createSegmentationSocket };
});
vi.mock("$lib/stores/websocket/xraysockets.store", () => ({ createSegmentationSocket }));

import { runAutofill } from "./autofill";

function dslResponse(refPoints: SegmentationRefPoints | null) {
    return {
        ok: true,
        json: async () => ({
            data: {
                meta: { total_items: refPoints ? 1 : 0 },
                result: refPoints ? [{ ref_points: refPoints }] : []
            }
        })
    };
}

beforeEach(() => {
    createSegmentationSocket.mockClear();
    socketHandlers.onStatus = undefined;
    socketHandlers.onDone = undefined;
    socketHandlers.onClose = undefined;
});

describe("runAutofill cache hit", () => {
    it("returns the cached ref_points without opening a segmentation socket", async () => {
        const refPoints: SegmentationRefPoints = {
            vertebraes: [
                { name: "S1", points: [[70, 460], [70, 400], [130, 400], [130, 460]] },
                { name: "L5", points: [[70, 390], [70, 330], [130, 330], [130, 390]] }
            ]
        };
        global.fetch = vi.fn().mockResolvedValue(dslResponse(refPoints));

        const statuses: string[] = [];
        const polygons = await runAutofill("1.2.3", new ArrayBuffer(0), (s) => statuses.push(s));

        expect(statuses).toEqual(["checking"]);
        expect(createSegmentationSocket).not.toHaveBeenCalled();
        expect(polygons).toHaveLength(2);
    });
});

describe("runAutofill cache miss", () => {
    it("uploads the DICOM and resolves via the segmentation socket's done event", async () => {
        const refPoints: SegmentationRefPoints = {
            vertebraes: [
                { name: "S1", points: [[70, 460], [70, 400], [130, 400], [130, 460]] },
                { name: "L5", points: [[70, 390], [70, 330], [130, 330], [130, 390]] }
            ]
        };
        global.fetch = vi.fn()
            .mockResolvedValueOnce(dslResponse(null))
            .mockResolvedValueOnce({ ok: true });

        const statuses: string[] = [];
        const promise = runAutofill("1.2.3", new ArrayBuffer(0), (s) => statuses.push(s));

        await vi.waitFor(() => expect(createSegmentationSocket).toHaveBeenCalledTimes(1));
        socketHandlers.onStatus?.("segmentation.processing");
        socketHandlers.onStatus?.("saving");
        socketHandlers.onDone?.(refPoints);

        const polygons = await promise;

        expect(statuses).toEqual(["checking", "uploading", "segmentation.processing", "saving"]);
        expect(polygons).toHaveLength(2);
    });

    it("rejects when the socket closes before a done event arrives", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(dslResponse(null))
            .mockResolvedValueOnce({ ok: true });

        const promise = runAutofill("1.2.3", new ArrayBuffer(0), () => {});

        await vi.waitFor(() => expect(createSegmentationSocket).toHaveBeenCalledTimes(1));
        socketHandlers.onClose?.();

        await expect(promise).rejects.toThrow();
    });
});

describe("runAutofill point-order safety net", () => {
    it("normalizes to the same canonical point order regardless of the backend's raw point order", async () => {
        const baseVertebraes = [
            { name: "raw-s1", points: [[70, 460], [70, 400], [130, 400], [130, 460]] as [number, number][] },
            { name: "raw-l5", points: [[70, 390], [70, 330], [130, 330], [130, 390]] as [number, number][] }
        ];

        function cyclicShift(points: [number, number][], n: number): [number, number][] {
            return points.map((_, i) => points[(i + n) % points.length]);
        }

        async function runWithShift(shift: number) {
            const refPoints: SegmentationRefPoints = {
                vertebraes: baseVertebraes.map((v) => ({ name: v.name, points: cyclicShift(v.points, shift) }))
            };
            global.fetch = vi.fn().mockResolvedValue(dslResponse(refPoints));
            return runAutofill("1.2.3", new ArrayBuffer(0), () => {});
        }

        const unshifted = await runWithShift(0);
        const shifted = await runWithShift(2);

        expect(shifted.map((p) => p.points)).toEqual(unshifted.map((p) => p.points));
    });
});
