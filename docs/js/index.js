$('.iocurve').each(function(){
    var $this = $(this);
    $this.iocurve($this.data('option'));
});


function randomHistogram( option ){
    var rangeX = option.x[1] - option.x[0];
    var count = parseInt(rangeX / option.dx) + 1;
    var data = [];
    for( var i=count; i--; ) data[i] = Math.random();
    return data;
}

$(window).resize(function(){
    $('.curve').trigger('resized');
});
$('.curvature > i').rangeSlider({
    limit: [0, 0.5],
    value: 0.5,
    step: 0.01
}).on('input', function(){
    var v = $(this).data('value');
    $(this).next().text(v);
    $('.curve').trigger('option', [{
        curvature: v
    }]);
});
$('.curve').each(function(){
    var option = $.extend(true, {
        height: '100%',
        curvature: 0.5,
        histogram: {},
        controlPoint: {
            visible: true
        },
        plot: {
            visible: true
        }
    }, $(this).data('option'));
    option.histogram.data = randomHistogram(option);
    var $curve = $(this).iocurve(option);
    $curve.on('anchor', function(ev, anchor){
        console.log(anchor.x, anchor.y);
    });
    $curve.on('output', function(ev, data){
        // console.log(data);
    });
});