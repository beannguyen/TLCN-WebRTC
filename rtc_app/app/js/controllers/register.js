angular.module('xenon.controllers')
    .controller('RegisterCtrl', function ($log, $scope, $rootScope, $state) {

        $rootScope.isLoginPage = true;
        $rootScope.isMainPage = false;
        $scope.credential = {};
        $scope.uiMsg = {};
        var socket = io();

        // alerts
        var alert = angular.element('.alert'),
            alertSuccess = angular.element('.alert-success'),
            alertDanger = angular.element('.alert-danger'),
            alertWarning = angular.element('.alert-warning');

        $scope.register = function () {
            socket.emit('create account', $scope.credential);
        };

        socket.on('created account', function (data) {

            console.log('created', data);
            $scope.credential = {};
            if (data.msg === 'created') {
                alert.addClass('hidden');
                alertSuccess.removeClass('hidden');
                setTimeout(function () {
                    $state.go('access.login');
                }, 1500);
            } else if (data.msg === 'account_exist') {

                alert.addClass('hidden');
                $scope.$apply(function () {

                    $scope.uiMsg.warning = 'Username already exist!';
                });
                alertWarning.removeClass('hidden');
            } else {
                alert.addClass('hidden');
                alertDanger.removeClass('hidden');
            }
        });
    });