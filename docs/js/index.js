window.hljs && hljs.initHighlightingOnLoad();

var $curves = $();

$('header .bg').each(function(){
    var $curve = $(this);
    $curve.iocurve({
        x: [0, 1],
        y: [0, 1],
        dx: 0.001,
        curvature: 0.25,
        css: {
            margin: 0
        },
        canvas: {
            height: $curve.height(),
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
    $curves = $curves.add($curve);
});

$('.iocurve').each(function(){
    var $this = $(this);
    var $input = $this.find('.input');
    var $curve = $this.find('.curve div');
    var $output = $this.find('.output');
    var $curvature = $curve.next('input[type="range"]');
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
    $curve.iocurve(option);
    $curves = $curves.add($curve);
    $input.on('scroll', function(){
        $output.scrollTop($input.scrollTop());
    });
    $output.on('scroll', function(){
        $input.scrollTop($output.scrollTop());
    });
    $curvature.rangeslider({ polyfill: false });
    $curvature.on('input', function(){
        var v = this.value;
        $curve.trigger('option', [{ curvature: v }]);
    });
});

$('.example .picture-edit').each(function(){
    var $canvas = $(this).find('canvas');
    var $curve = $(this).find('.curve');
    var $label = $(this).find('label');
    var $kind = $(this).find('[name="kind"]');
    var image = new Image();
    image.onload = onload;
    image.src = $canvas.data('src');
    $curves = $curves.add($curve);

    function onload(){
        var canvas = $canvas[0];
        canvas.width = image.width;
        canvas.height = image.height;
        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        var imgdata0 = context.getImageData(0, 0, canvas.width, canvas.height);
        var imgdata1 = context.createImageData(canvas.width, canvas.height);
        var src = imgdata0.data;
        var dst = imgdata1.data;
        var histogram = getHistogramRGB(src);
        var onOutput = {
            RGB: function( ev, data ){
                for( var i=data.length; i--; ) data[i] = Math.round(data[i]);
                for( var i=0; i<src.length; i+=4 ){
                    dst[i] = data[src[i]];
                    dst[i+1] = data[src[i+1]];
                    dst[i+2] = data[src[i+2]];
                    dst[i+3] = src[i+3];
                }
                context.putImageData(imgdata1, 0, 0);
            },
            R: function( ev, data ){
                for( var i=data.length; i--; ) data[i] = Math.round(data[i]);
                for( var i=0; i<src.length; i+=4 ){
                    dst[i] = data[src[i]];
                    dst[i+1] = src[i+1];
                    dst[i+2] = src[i+2];
                    dst[i+3] = src[i+3];
                }
                context.putImageData(imgdata1, 0, 0);
            },
            G: function( ev, data ){
                for( var i=data.length; i--; ) data[i] = Math.round(data[i]);
                for( var i=0; i<src.length; i+=4 ){
                    dst[i] = src[i];
                    dst[i+1] = data[src[i+1]];
                    dst[i+2] = src[i+2];
                    dst[i+3] = src[i+3];
                }
                context.putImageData(imgdata1, 0, 0);
            },
            B: function( ev, data ){
                for( var i=data.length; i--; ) data[i] = Math.round(data[i]);
                for( var i=0; i<src.length; i+=4 ){
                    dst[i] = src[i];
                    dst[i+1] = src[i+1];
                    dst[i+2] = data[src[i+2]];
                    dst[i+3] = src[i+3];
                }
                context.putImageData(imgdata1, 0, 0);
            }
        };
        $kind.each(function(){
            var kind = this.value;
            $curve.filter('.' + kind).iocurve({
                histogram: {
                    data: histogram[kind]
                }
            }).on('output', onOutput[kind]);
        });
        $kind.change(function(){
            var $checked = $kind.filter(':checked');
            $label.removeClass('checked');
            $curve.addClass('hide');
            $checked.parent().addClass('checked');
            var $target = $curve.filter('.' + $checked.val());
            $target.removeClass('hide').trigger('data', [function(data){
                $target.trigger('output', [data]);
            }]);
        });
    }

    function getHistogramRGB( src ){
        var RGB = [];
        var R = [];
        var G = [];
        var B = [];
        for( var i=256; i--; ) RGB[i] = R[i] = G[i] = B[i] = 0;
        for( var i=0; i<src.length; i+=4 ){
            RGB[src[i]]++;
            RGB[src[i+1]]++;
            RGB[src[i+2]]++;
            R[src[i]]++;
            G[src[i+1]]++;
            B[src[i+2]]++;
        }
        var max = Math.max(
            Math.max.apply(null, RGB),
            Math.max.apply(null, R),
            Math.max.apply(null, G),
            Math.max.apply(null, B)
        );
        for( var i=256; i--; ){
            RGB[i] /= max;
            R[i] /= max;
            G[i] /= max;
            B[i] /= max;
        }
        return { RGB:RGB, R:R, G:G, B:B };
    }
});

$(window).resize(function(){
    $curves.trigger('resized');
});
