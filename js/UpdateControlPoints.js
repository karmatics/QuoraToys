
class UpdateControlPoints {

  static run(vertices, iterations = 8) {
    if (!vertices || vertices.length === 0) return;
    if (vertices.length === 1) {
      vertices[0].controlPoints = [
        vertices[0].point.slice(),
        vertices[0].point.slice(),
      ];
      return;
    }

    const gu = GeometryUtils;

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      if (!v.controlPoints || !Array.isArray(v.controlPoints) || v.controlPoints.length < 2) {
        v.controlPoints = [v.point.slice(), v.point.slice()];
      }
    }

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        const prevVertex = vertices[i - 1];
        const nextVertex = vertices[i + 1];

        // DECOUPLED CUSP KNOT HANDLING:
        // If a knot is a cusp, it decouples tangencies completely.
        // Incoming side treats it as an end-point; outgoing side treats it as a start-point.
        if (vertex.isCusp) {
          if (nextVertex) {
            const nextCp = nextVertex.controlPoints ? nextVertex.controlPoints[0] : nextVertex.point;
            const outTangent = gu.makeUnitVector(nextCp, vertex.point);
            const distNext = gu.getDistance(vertex.point, nextVertex.point);
            const scaleNext = (distNext / 3) * (vertex.curvature || 1.0) * (2 - (vertex.balance || 1.0));
            vertex.controlPoints[1] = gu.projectPoint(vertex.point, outTangent, scaleNext);
          } else {
            vertex.controlPoints[1] = vertex.point.slice();
          }

          if (prevVertex) {
            const prevCp = prevVertex.controlPoints ? prevVertex.controlPoints[1] : prevVertex.point;
            const inTangent = gu.makeUnitVector(vertex.point, prevCp);
            const distPrev = gu.getDistance(vertex.point, prevVertex.point);
            const scalePrev = (distPrev / 3) * (vertex.curvature || 1.0) * (vertex.balance || 1.0);
            vertex.controlPoints[0] = gu.projectPoint(vertex.point, inTangent, scalePrev);
          } else {
            vertex.controlPoints[0] = vertex.point.slice();
          }
          continue;
        }

        // SMOOTH C1 CONTINUOUS KNOT HANDLING:
        const naturalTangent = UpdateControlPoints.computeCounterfactualTangent(vertices, i);
        vertex._naturalTangent = naturalTangent.slice();

        let tangent = naturalTangent;
        if (vertex.tangentAngleOffset) {
          tangent = gu.rotateVector(naturalTangent, vertex.tangentAngleOffset);
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
  static computeCounterfactualTangent(vertices, knotIdx) {
    if (!vertices || vertices.length < 2 || knotIdx < 0 || knotIdx >= vertices.length) {
      return [1, 0];
    }

    const gu = GeometryUtils;
    const n = vertices.length;
    const vertex = vertices[knotIdx];
    const prevVertex = vertices[knotIdx - 1];
    const nextVertex = vertices[knotIdx + 1];

    // Natural forward tangent along the curve direction of travel (i -> i+1)
    let forwardTangent;
    if (prevVertex && nextVertex) {
      const toNext = gu.makeUnitVector(
        nextVertex.controlPoints ? nextVertex.controlPoints[0] : nextVertex.point,
        vertex.point
      );
      const fromPrev = gu.makeUnitVector(
        vertex.point,
        prevVertex.controlPoints ? prevVertex.controlPoints[1] : prevVertex.point
      );
      forwardTangent = gu.normalize(gu.addVectors(toNext, fromPrev));
    } else if (nextVertex) {
      // Knot 0: forward tangent points towards next vertex
      const nextPt = nextVertex.controlPoints ? nextVertex.controlPoints[0] : nextVertex.point;
      forwardTangent = gu.makeUnitVector(nextPt, vertex.point);
    } else if (prevVertex) {
      // Knot n: forward tangent points along arrival trajectory from previous vertex
      const prevPt = prevVertex.controlPoints ? prevVertex.controlPoints[1] : prevVertex.point;
      forwardTangent = gu.makeUnitVector(vertex.point, prevPt);
    }

    return forwardTangent || [1, 0];
  }
}

