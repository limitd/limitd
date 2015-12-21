var ProtoBuf = require('protobufjs');
var path = require('path');

var decode = ProtoBuf.Reflect.Message.Field.prototype.decode;

ProtoBuf.Reflect.Message.Field.prototype.decode = function () {
  var value = decode.apply(this, arguments);
  if (ProtoBuf.TYPES["enum"] === this.type) {
    var values = this.resolvedType.children;
    for (var i=0; i<values.length; i++){
      if (values[i].id == value){
        return values[i].name;
      }
    }
  }
  return value;
};


var builder = ProtoBuf.loadProtoFile(path.join(__dirname, "/../protocol/Index.proto"));

module.exports = builder.build("limitd");
