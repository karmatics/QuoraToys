class BezierVertex {

  constructor(point, pointType = 'click') {
      this.point = point.slice();
      this.controlPoints = [point.slice(), point.slice()];
      this.tangents = [null, null];
      this.curvature = 1;
      this.balance = 1;
      this.pointType = pointType;
      this.isTentative = false;
      this.isCusp = false;
      this.isExplicitTangent = false;
      this.cuspInAngleOffset = 0;
      this.cuspOutAngleOffset = 0;
    }

  toJSON() {
      return {
        point: this.point,
        controlPoints: this.controlPoints,
        tangents: this.tangents,
        curvature: this.curvature,
        balance: this.balance,
        pointType: this.pointType,
        isTentative: this.isTentative,
        isCusp: this.isCusp,
        isExplicitTangent: this.isExplicitTangent,
        cuspInAngleOffset: this.cuspInAngleOffset || 0,
        cuspOutAngleOffset: this.cuspOutAngleOffset || 0
      };
    }

  static fromJSON(obj) {
      const v = new BezierVertex(obj.point, obj.pointType);
      v.controlPoints = obj.controlPoints;
      v.tangents = obj.tangents;
      v.curvature = obj.curvature;
      v.balance = obj.balance;
      v.isTentative = !!obj.isTentative;
      v.isCusp = !!obj.isCusp;
      v.isExplicitTangent = !!obj.isExplicitTangent;
      v.cuspInAngleOffset = obj.cuspInAngleOffset || 0;
      v.cuspOutAngleOffset = obj.cuspOutAngleOffset || 0;
      return v;
    }
}

