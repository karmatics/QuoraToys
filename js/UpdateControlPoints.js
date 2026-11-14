
class UpdateControlPoints {

  static run(vertices, iterations = 8) {
        if (!vertices || vertices.length === 0) return;
        if (vertices.length === 1) {
          vertices[0].controlPoints = [vertices[0].point.slice(), vertices[0].point.slice()];
          return;
        }

        const gu = GeometryUtils;

        UpdateControlPoints.computeNaturalBaselines(vertices, iterations);

        for (let i = 0; i < vertices.length; i++) {
          const vertex = vertices[i];
          const prevVertex = vertices[i - 1];
          const nextVertex = vertices[i + 1];
          const balance = vertex.balance || 1;
          const curvature = vertex.curvature || 1;

          if (vertex.isCusp) {
            const baseOut = vertex._naturalOutTangent || [1, 0];
            const baseIn = vertex._naturalInTangent || [-1, 0];
            const outDir = vertex.cuspOutAngleOffset ? gu.rotateVector(baseOut, vertex.cuspOutAngleOffset) : baseOut;
            const inDir = vertex.cuspInAngleOffset ? gu.rotateVector(baseIn, vertex.cuspInAngleOffset) : baseIn;

            if (nextVertex) {
              const dist = gu.getDistance(vertex.point, nextVertex.point);
              vertex.controlPoints[1] = gu.projectPoint(vertex.point, outDir, (dist / 3) * curvature * (2 - balance));
            } else {
              vertex.controlPoints[1] = vertex.point.slice();
            }

            if (prevVertex) {
              const dist = gu.getDistance(vertex.point, prevVertex.point);
              vertex.controlPoints[0] = gu.projectPoint(vertex.point, inDir, (dist / 3) * curvature * balance);
            } else {
              vertex.controlPoints[0] = vertex.point.slice();
            }
            continue;
          }

          const baseT = vertex._naturalTangent || [1, 0];
          const tangent = vertex.tangentAngleOffset ? gu.rotateVector(baseT, vertex.tangentAngleOffset) : baseT;
          const reversedTangent = [-tangent[0], -tangent[1], -tangent[2] || 0];

          if (nextVertex) {
            const dist = gu.getDistance(vertex.point, nextVertex.point);
            vertex.controlPoints[1] = gu.projectPoint(vertex.point, tangent, (dist / 3) * curvature * (2 - balance));
          } else {
            vertex.controlPoints[1] = vertex.point.slice();
          }

          if (prevVertex) {
            const dist = gu.getDistance(vertex.point, prevVertex.point);
            vertex.controlPoints[0] = gu.projectPoint(vertex.point, reversedTangent, (dist / 3) * curvature * balance);
          } else {
            vertex.controlPoints[0] = vertex.point.slice();
          }
        }

        const hasCustomOffset = vertices.some(v => v.isCusp || Math.abs(v.tangentAngleOffset || 0) > 1e-4);
        if (hasCustomOffset) {
          for (let iter = 0; iter < 4; iter++) {
            for (let i = 0; i < vertices.length; i++) {
              const v = vertices[i];
              if (v.isCusp || v.isExplicitTangent || Math.abs(v.tangentAngleOffset || 0) > 1e-4) continue;

              const prevV = vertices[i - 1];
              const nextV = vertices[i + 1];
              let t;
              if (prevV && nextV) {
                const toNext = gu.makeUnitVector(nextV.controlPoints[0], v.point);
                const fromPrev = gu.makeUnitVector(v.point, prevV.controlPoints[1]);
                t = gu.normalize(gu.addVectors(toNext, fromPrev));
              } else if (nextV) {
                t = gu.makeUnitVector(nextV.controlPoints[0], v.point);
              } else if (prevV) {
                t = gu.makeUnitVector(v.point, prevV.controlPoints[1]);
              }
              if (!t) continue;

              const bal = v.balance || 1;
              const curv = v.curvature || 1;
              const revT = [-t[0], -t[1], -t[2] || 0];
              if (nextV) {
                const d = gu.getDistance(v.point, nextV.point);
                v.controlPoints[1] = gu.projectPoint(v.point, t, (d / 3) * curv * (2 - bal));
              }
              if (prevV) {
                const d = gu.getDistance(v.point, prevV.point);
                v.controlPoints[0] = gu.projectPoint(v.point, revT, (d / 3) * curv * bal);
              }
            }
          }
        }
      }
  static computeCounterfactualTangent(vertices, knotIdx) {
      if (!vertices || vertices.length < 2 || knotIdx < 0 || knotIdx >= vertices.length) {
        return [1, 0];
      }

      if (vertices[knotIdx]._naturalTangent) {
        return vertices[knotIdx]._naturalTangent.slice();
      }

      const clones = vertices.map(v => ({
        point: v.point.slice(),
        controlPoints: [v.point.slice(), v.point.slice()],
        curvature: v.curvature || 1,
        balance: v.balance || 1,
        isCusp: Boolean(v.isCusp)
      }));
      UpdateControlPoints.computeNaturalBaselines(clones, 8);
      return clones[knotIdx]._naturalTangent || [1, 0];
    }

  static computeNaturalBaselines(vertices, iterations = 8) {
        if (!vertices || vertices.length === 0) return;
        if (vertices.length === 1) {
          vertices[0].controlPoints = [vertices[0].point.slice(), vertices[0].point.slice()];
          vertices[0]._naturalTangent = [1, 0];
          return;
        }

        const gu = GeometryUtils;

        for (let i = 0; i < vertices.length; i++) {
          vertices[i].controlPoints = [vertices[i].point.slice(), vertices[i].point.slice()];
        }

        for (let iter = 0; iter < iterations; iter++) {
          for (let i = 0; i < vertices.length; i++) {
            const vertex = vertices[i];
            const prevVertex = vertices[i - 1];
            const nextVertex = vertices[i + 1];

            if (vertex.isCusp) {
              if (nextVertex) {
                const outTangent = gu.makeUnitVector(nextVertex.controlPoints[0], vertex.point);
                vertex._naturalOutTangent = outTangent.slice();
                const distNext = gu.getDistance(vertex.point, nextVertex.point);
                const scaleNext = (distNext / 3) * (vertex.curvature || 1.0) * (2 - (vertex.balance || 1.0));
                vertex.controlPoints[1] = gu.projectPoint(vertex.point, outTangent, scaleNext);
              } else {
                vertex._naturalOutTangent = [1, 0];
                vertex.controlPoints[1] = vertex.point.slice();
              }

              if (prevVertex) {
                const inTangent = gu.makeUnitVector(prevVertex.controlPoints[1], vertex.point);
                vertex._naturalInTangent = inTangent.slice();
                const distPrev = gu.getDistance(vertex.point, prevVertex.point);
                const scalePrev = (distPrev / 3) * (vertex.curvature || 1.0) * (vertex.balance || 1.0);
                vertex.controlPoints[0] = gu.projectPoint(vertex.point, inTangent, scalePrev);
              } else {
                vertex._naturalInTangent = [-1, 0];
                vertex.controlPoints[0] = vertex.point.slice();
              }
              continue;
            }

            let naturalTangent;
            if (prevVertex && nextVertex) {
              const toNext = gu.makeUnitVector(nextVertex.controlPoints[0], vertex.point);
              const fromPrev = gu.makeUnitVector(vertex.point, prevVertex.controlPoints[1]);
              naturalTangent = gu.normalize(gu.addVectors(toNext, fromPrev));
            } else if (nextVertex) {
              naturalTangent = gu.makeUnitVector(nextVertex.controlPoints[0], vertex.point);
            } else if (prevVertex) {
              naturalTangent = gu.makeUnitVector(vertex.point, prevVertex.controlPoints[1]);
            }

            if (!naturalTangent) continue;
            vertex._naturalTangent = naturalTangent.slice();

            const balance = vertex.balance || 1;
            const curvature = vertex.curvature || 1;
            const reversedTangent = [-naturalTangent[0], -naturalTangent[1], -naturalTangent[2] || 0];

            if (nextVertex) {
              const dist = gu.getDistance(vertex.point, nextVertex.point);
              vertex.controlPoints[1] = gu.projectPoint(vertex.point, naturalTangent, (dist / 3) * curvature * (2 - balance));
            } else {
              vertex.controlPoints[1] = vertex.point.slice();
            }

            if (prevVertex) {
              const dist = gu.getDistance(vertex.point, prevVertex.point);
              vertex.controlPoints[0] = gu.projectPoint(vertex.point, reversedTangent, (dist / 3) * curvature * balance);
            } else {
              vertex.controlPoints[0] = vertex.point.slice();
            }
          }
        }
      }
}

