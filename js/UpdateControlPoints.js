
class UpdateControlPoints {

  static run(vertices, iterations = 8, affectedRange = null) {
      if (!vertices || vertices.length === 0) return;
      if (vertices.length === 1) {
        vertices[0].controlPoints = [
          vertices[0].point.slice(),
          vertices[0].point.slice(),
        ];
        return;
      }

      const gu = GeometryUtils;
      const isLocal = affectedRange && typeof affectedRange === 'object';
      const startIdx = isLocal ? Math.max(0, affectedRange.start) : 0;
      const endIdx = isLocal ? Math.min(vertices.length - 1, affectedRange.end) : vertices.length - 1;

      // Ensure control points exist; keep distant handles locked
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        if (!v.controlPoints || !Array.isArray(v.controlPoints) || v.controlPoints.length < 2) {
          v.controlPoints = [v.point.slice(), v.point.slice()];
        } else if (!isLocal || (i >= startIdx && i <= endIdx)) {
          if (!v.controlPoints[0] || !v.controlPoints[1]) {
            v.controlPoints = [v.point.slice(), v.point.slice()];
          }
        }
      }

      // Relaxation loop iterates only across the active local neighborhood
      for (let iter = 0; iter < iterations; iter++) {
        for (let i = startIdx; i <= endIdx; i++) {
          const vertex = vertices[i];
          const prevVertex = vertices[i - 1];
          const nextVertex = vertices[i + 1];

          let tangent;

          if (vertex.tangents && vertex.tangents[1]) {
            tangent = vertex.tangents[1];
          } else if (prevVertex && nextVertex) {
            const toNext = gu.makeUnitVector(
              nextVertex.controlPoints ? nextVertex.controlPoints[0] : nextVertex.point,
              vertex.point
            );
            const fromPrev = gu.makeUnitVector(
              vertex.point,
              prevVertex.controlPoints ? prevVertex.controlPoints[1] : prevVertex.point
            );
            tangent = gu.normalize(gu.addVectors(toNext, fromPrev));
          } else if (nextVertex) {
            const nextCp = nextVertex.controlPoints ? nextVertex.controlPoints[0] : nextVertex.point;
            tangent = gu.makeUnitVector(nextCp, vertex.point);
          } else if (prevVertex) {
            const prevCp = prevVertex.controlPoints ? prevVertex.controlPoints[1] : prevVertex.point;
            tangent = gu.makeUnitVector(vertex.point, prevCp);
          }

          if (!tangent) continue;

          if (vertex.tangentAngleOffset) {
            tangent = gu.rotateVector(tangent, vertex.tangentAngleOffset);
          }

          const balance = vertex.balance || 1;
          const curvature = vertex.curvature || 1;
          const reversedTangent = [-tangent[0], -tangent[1], -tangent[2] || 0];

          if (nextVertex) {
            const dist = gu.getDistance(vertex.point, nextVertex.point);
            const scale = (dist / 3) * curvature * (2 - balance);
            vertex.controlPoints[1] = gu.projectPoint(
              vertex.point,
              tangent,
              scale
            );
          } else {
            vertex.controlPoints[1] = vertex.point.slice();
          }

          if (prevVertex) {
            const dist = gu.getDistance(vertex.point, prevVertex.point);
            const scale = (dist / 3) * curvature * balance;
            vertex.controlPoints[0] = gu.projectPoint(
              vertex.point,
              reversedTangent,
              scale
            );
          } else {
            vertex.controlPoints[0] = vertex.point.slice();
          }
        }
      }
    }
}

