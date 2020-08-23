hljs.initHighlightingOnLoad();

var $bg = $('header .bg');
$bg.iocurve({
    x: [0, 1],
    y: [0, 1],
    dx: 0.001,
    curvature: 0.25,
    css: {
        margin: 0
    },
    canvas: {
        height: $bg.height(),
        fillStyle: 'transparent'
    },
    grid: {
        visible: false
    },
    anchor: {
        points: [ [0, 0], [0.3, 0.5], [0.7, 0.1], [1, 1] ]
    },
    bar: {
        fillStyle: {
            positive: 'rgba(255, 255, 255, 0.02)'
        }
    }
});

$(window).resize(function(){
    $bg.trigger('resized');
});

$('.iocurve').each(function(){
    var $this = $(this);
    var $input = $this.find('.input');
    var $curve = $this.find('.curve div');
    var $output = $this.find('.output');
    var $curvature = $curve.next('input');
    var option = $curve.data('option');
    $input.text(function(){
        var x0 = option.x ? option.x[0] : 0;
        var x1 = option.x ? option.x[1] : 255;
        var y0 = option.y ? option.y[0] : 0;
        var y1 = option.y ? option.y[1] : 255;
        var dx = option.dx || 1;
        var rangeX = x1 - x0;
        var count = (rangeX / dx)|0;
        var dy = (y1 - y0) / count;
        var a = new Array(count);
        for( var i=count; i--; ) a[i] = y0 + dy * i;
        a[count] = y1;
        return a;
    }().join('\r\n'));
    $curve.on('output', function(ev, data){
        for( var i=data.length; i--; ) data[i] = Math.round(data[i]);
        $output.text(data.join('\r\n'));
    });
    if( option.histogram ) option.histogram.data = randomHistogram(option);
    $curve.iocurve(option);
    $input.on('scroll', function(){
        $output.scrollTop($input.scrollTop());
    });
    $output.on('scroll', function(){
        $input.scrollTop($output.scrollTop());
    });
    if( $curvature.length ) $curvature.on('input', function(){
        var v = this.value;
        $curve.trigger('option', [{ curvature: v }]);
    });
    function randomHistogram( option ){
        var rangeX = option.x[1] - option.x[0];
        var count = 1 + (rangeX / option.dx)|0;
        var data = [];
        for( var i=count; i--; ) data[i] = Math.random();
        return data;
    }
});

$('.example .picture-edit').each(function(){
    var $canvas = $(this).find('canvas');
    var $curve = $(this).find('.curve');
    var canvas = $canvas[0];
    var context = canvas.getContext('2d');
    var imgdata0;
    var imgdata1;
    var image = new Image();
    image.onload = function(){
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        imgdata0 = context.getImageData(0, 0, canvas.width, canvas.height);
        imgdata1 = context.createImageData(canvas.width, canvas.height);
    };
    image.src = $canvas.data('src');
    $curve.iocurve().on('output', function(ev, data){
        if( !imgdata1 ) return;
        for( var i=data.length; i--; ) data[i] = Math.round(data[i]);
        var src = imgdata0.data;
        var dst = imgdata1.data;
        for( var i=0; i<src.length; i+=4 ){
            dst[i] = data[src[i]];
            dst[i+1] = data[src[i+1]];
            dst[i+2] = data[src[i+2]];
            dst[i+3] = src[i+3];
        }
        context.putImageData(imgdata1, 0, 0);
    });
});