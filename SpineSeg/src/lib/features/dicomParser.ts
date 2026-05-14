import type { Polygon } from "$lib/shared/geometry/geometry.type";



export function formatJson2Polygons(data: any): Polygon[] {
  console.log(data.vertebraes.map((e: any) => {
    return {
      id: e.name,
      points: e.points.map((p: any) => {
        return { x: p[0], y: p[1] };
      })
    }
  }));
  return data.vertebraes.map((e: any) => {
    return {
      id: e.name,
      points: e.points.map((p: any) => {
        return { x: p[0], y: p[1] };
      })
    }
  })
}

  // const processingStatusStore = (projection == "side") ? sideProcessingStatusStore: frontalProcessingStatusStore;

  // autoPolygons.update(store => {
  //   store[projection] = [];
  //   return store;
  // })
  // processingStatusStore.set("image.processing");

  // fetch('/api/dsl/select/', {
  //   method: 'POST',
  //   headers: {
  //       'Content-Type': 'application/json',
  //       'X-CSRFToken': window.CSRF_TOKEN
  //   },
  //   body: JSON.stringify({
  //     "dataset": "dicom_images",
  //     "select": [
  //       "ref_points"
  //     ],
  //     "filter": {
  //       "field": "sop_uid",
  //       "op": "eq",
  //       "value": newImage.sopInstanceUID
  //     }
  //   })
  // })
  // .then(response => {
  //   if (!response.ok) throw new Error('Upload failed');
  //   return response.json();
  // })
  // .then(data => {
  //   if (data.data.meta.total_items > 0) {
  //     processingStatusStore.set("done");
  //     autoPolygons.update(store => {
  //       store[projection] = formatJson2Polygons(data.data.result[0].ref_points);
  //       return store;
  //     })
  //   } else {
  //     createProjectionSocket(
  //       projection,
  //       newImage.sopInstanceUID,
  //       () => {
  //         const formData = new FormData();
  //         formData.append('file', file);

  //         console.log(`Socket open. Starting upload for ${newImage.sopInstanceUID}...`);

  //         fetch('/api/dcm/parse/', {
  //           method: 'POST',
  //           headers: {
  //               'X-CSRFToken': window.CSRF_TOKEN
  //           },
  //           body: formData,
  //         })
  //         .then(response => {
  //           if (!response.ok) throw new Error('Upload failed');
  //           return response.json();
  //         })
  //         .then(data => {
  //           console.log("Upload complete. Server is now processing.");
  //         })
  //         .catch(err => {
  //           console.error("Upload error:", err);
  //         });
  //       }
  //     );
  //   }
  // })
  // .catch(err => {
  //   console.error("Upload error:", err);
  // });


// --- 1. UTILITY HELPERS ---

